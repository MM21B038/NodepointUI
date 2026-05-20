import type { ChatMessage, ProvenanceEntry } from "@/database/workspaceStorage";
import { buildApiUrl, wsBaseUrl } from "@/database/apiUrl";
import type { ChatBlock, ChatTurn } from "@/lib/chatTypes";
import {
  applyStreamEvent,
  finalizeAssistantBlocks,
  messagesToTurns,
} from "@/lib/chatStreamReducer";
import { readMigratedLocalStorage } from "@/lib/migrateStorageKey";
import {
  getStoredViewScope,
  isSelectableGroup,
  setStoredViewScope,
  type ViewScopeMode,
} from "@/lib/viewScope";

export type { ViewScopeMode };

/** Internal chat routing key: workspace name or `group:<name>`. */
export function groupChatKey(groupName: string): string {
  return `group:${groupName.trim()}`;
}

export function isGroupChatKey(chatKey: string): boolean {
  return chatKey.startsWith("group:");
}

export function groupNameFromChatKey(chatKey: string): string {
  return chatKey.slice("group:".length);
}

const CHAT_WORKSPACE_KEY = "nodepoint_chat_workspace";
const LEGACY_CHAT_WORKSPACE_KEY = "prajna_chat_workspace";

async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return data.error || data.detail || data.message || response.statusText;
  } catch {
    return response.statusText;
  }
}

function encodeWorkspaceKey(workspaceKey: string): string {
  return encodeURIComponent(workspaceKey);
}

// --- REST types (one chat per workspace) ---

export interface ChatMessageRecord {
  id: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  reasoning_content: string | null;
  tool_calls: unknown | null;
  tool_call_id: string | null;
  tool_name: string | null;
  sequence: number;
  created_at: string;
}

export interface WorkspaceChatResponse {
  workspace?: string;
  group?: string;
  flagged?: boolean;
  is_flag?: boolean;
  messages: ChatMessageRecord[];
}

export interface ClearChatResponse {
  message: string;
  workspace: string;
}

export interface ChatSummaryEntry {
  workspace: string;
  is_flag: boolean;
  updated_at: string | null;
  message_count: number;
}

export interface ChatSummaryGroupResponse {
  workspaces: ChatSummaryEntry[];
}

// --- WebSocket event types ---

export type ChatStreamEvent =
  | { type: "chat.ready"; workspace: string }
  | { type: "pong" }
  | { type: "thinking_token"; token: string }
  | { type: "assistant_response_token"; token: string }
  | { type: "section"; section: string; action: "open" | "close" }
  | { type: "tool_calls"; names: string[] }
  | { type: "tool_call_start"; tool_call_id: string; tool_name: string }
  | { type: "tool_call_delta"; tool_call_id: string; arguments_delta: string }
  | { type: "tool_call_end"; tool_call_id: string }
  | { type: "assistant_tool_calls_message"; tool_calls?: unknown; content?: string; reasoning_content?: string }
  | { type: "tool_completed"; tool_name: string; tool_call_id: string; ok: boolean }
  | { type: "tool_result"; result: unknown; ok: boolean; tool_call_id?: string; tool_name?: string }
  | { type: "agent_turn_start"; turn_index?: number }
  | { type: "model_turn_complete"; finish_reason?: string }
  | { type: "agent_session_done" }
  | { type: "chat.compressed" }
  | { type: "chat.done" }
  | { type: "chat.cancelled" }
  | { type: "error"; message: string }
  | { type: string; [key: string]: unknown };

export interface ChatReadyEvent {
  type: "chat.ready";
  workspace: string;
}

export interface ChatStreamCallbacks {
  onReady?: (event: ChatReadyEvent) => void;
  onThinkingToken?: (token: string) => void;
  onResponseToken?: (token: string) => void;
  onSection?: (section: string, action: "open" | "close") => void;
  onToolCalls?: (names: string[]) => void;
  onToolCompleted?: (toolName: string, toolCallId: string, ok: boolean) => void;
  onBlocksChange?: (blocks: ChatBlock[]) => void;
  onCompressed?: () => void;
  onCancelled?: () => void;
  onEvent?: (event: ChatStreamEvent) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
}

export type { ChatBlock, ChatTurn };
export { messagesToTurns, finalizeAssistantBlocks };

/** @deprecated Use getStoredViewScope from @/lib/viewScope */
export { getStoredViewScope as getStoredChatScope } from "@/lib/viewScope";

/** @deprecated Use setStoredViewScope from @/lib/viewScope */
export function setStoredChatScope(scope: "workspace" | "global"): void {
  if (scope === "global") {
    const { groupName } = getStoredViewScope();
    setStoredViewScope("group", groupName);
  } else {
    setStoredViewScope("workspace", null);
  }
}

/** @deprecated Use ViewScopeMode */
export type ChatScope = "workspace" | "global";

export function getStoredChatWorkspace(): string | null {
  try {
    return readMigratedLocalStorage(CHAT_WORKSPACE_KEY, LEGACY_CHAT_WORKSPACE_KEY);
  } catch {
    return null;
  }
}

export function setStoredChatWorkspace(workspaceName: string): void {
  try {
    localStorage.setItem(CHAT_WORKSPACE_KEY, workspaceName);
  } catch {
    /* ignore */
  }
}

/** WebSocket / internal key for the active chat target. */
export function resolveChatKey(
  mode: ViewScopeMode,
  workspaceName: string | null,
  groupName: string | null
): string {
  if (mode === "group") {
    if (!groupName?.trim() || !isSelectableGroup(groupName)) {
      throw new Error("Select a group for group-scoped chat.");
    }
    return groupChatKey(groupName);
  }
  if (!workspaceName?.trim()) {
    throw new Error("Select a workspace for workspace-scoped chat.");
  }
  return workspaceName.trim();
}

function groupChatRestUrl(groupName: string): string {
  return buildApiUrl(`/chat/group/${encodeWorkspaceKey(groupName)}/`);
}

function chatRestUrl(
  mode: ViewScopeMode,
  workspaceName: string | null,
  groupName: string | null
): string {
  if (mode === "group") {
    if (!groupName?.trim() || !isSelectableGroup(groupName)) {
      throw new Error("Select a group for group-scoped chat.");
    }
    return groupChatRestUrl(groupName.trim());
  }
  const name = workspaceName?.trim();
  if (!name) throw new Error("Select a workspace for workspace-scoped chat.");
  return buildApiUrl(`/chat/${encodeWorkspaceKey(name)}/`);
}

export async function getChat(
  mode: ViewScopeMode,
  workspaceName: string | null,
  groupName: string | null
): Promise<WorkspaceChatResponse> {
  const response = await fetch(chatRestUrl(mode, workspaceName, groupName));
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return response.json();
}

export async function clearChat(
  mode: ViewScopeMode,
  workspaceName: string | null,
  groupName: string | null
): Promise<ClearChatResponse> {
  const response = await fetch(chatRestUrl(mode, workspaceName, groupName), {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return response.json();
}

export async function getChatSummary(
  params: { workspaceName: string } | { group: string }
): Promise<ChatSummaryEntry | ChatSummaryGroupResponse> {
  const searchParams = new URLSearchParams();
  if ("group" in params) {
    searchParams.set("group", params.group);
  } else {
    searchParams.set("workspace_name", params.workspaceName);
  }
  const response = await fetch(buildApiUrl("/chat/summary/", Object.fromEntries(searchParams)));
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return response.json();
}

export async function loadChatTurns(
  mode: ViewScopeMode,
  workspaceName: string | null,
  groupName: string | null
): Promise<{
  chatKey: string;
  mode: ViewScopeMode;
  workspace: string;
  turns: ChatTurn[];
}> {
  const chatKey = resolveChatKey(mode, workspaceName, groupName);
  const detail = await getChat(mode, workspaceName, groupName);
  const workspace =
    detail.workspace ??
    detail.group ??
    (mode === "group" && groupName
      ? `group: ${groupName}`
      : workspaceName ?? chatKey);
  return {
    chatKey,
    mode,
    workspace,
    turns: messagesToTurns(detail.messages),
  };
}

export function chatMessagesToLegacy(messages: ChatMessageRecord[]): ChatMessage[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      id: m.id,
      type: m.role === "user" ? "user" : "bot",
      text: m.content,
      timestamp: new Date(m.created_at),
    }));
}

export async function loadChatHistory(
  mode: ViewScopeMode,
  workspaceName: string | null,
  groupName: string | null
): Promise<ChatMessage[]> {
  const detail = await getChat(mode, workspaceName, groupName);
  return chatMessagesToLegacy(detail.messages);
}

function chatWebSocketPath(chatKey: string): string {
  if (isGroupChatKey(chatKey)) {
    const name = groupNameFromChatKey(chatKey);
    return `group/${encodeWorkspaceKey(name)}/`;
  }
  return `${encodeWorkspaceKey(chatKey)}/`;
}

function chatWebSocketUrl(chatKey: string): string {
  return `${wsBaseUrl()}/ws/chat/${chatWebSocketPath(chatKey)}`;
}

export function sendChatTurn(
  chatKey: string,
  content: string,
  callbacks: ChatStreamCallbacks = {},
  options?: { excludeServers?: string[] }
): { cancel: () => void; done: Promise<{ answer: string; thinking: string; blocks: ChatBlock[] }> } {
  const ws = new WebSocket(chatWebSocketUrl(chatKey));
  let thinking = "";
  let answer = "";
  let blocks: ChatBlock[] = [];
  let settled = false;
  let readyReceived = false;
  let turnCompleted = false;

  const emitBlocks = () => {
    callbacks.onBlocksChange?.(blocks);
  };

  const applyEventToBlocks = (data: ChatStreamEvent) => {
    blocks = applyStreamEvent(blocks, data);
    emitBlocks();
  };

  const finish = (
    resolve: (v: { answer: string; thinking: string; blocks: ChatBlock[] }) => void,
    reject: (e: Error) => void
  ) => ({
    resolve: (value: { answer: string; thinking: string; blocks: ChatBlock[] }) => {
      if (settled) return;
      settled = true;
      ws.close();
      resolve(value);
    },
    reject: (err: Error) => {
      if (settled) return;
      settled = true;
      ws.close();
      reject(err);
    },
  });

  let finishHandlers: ReturnType<typeof finish> | null = null;
  let timeoutId: ReturnType<typeof window.setTimeout> | undefined;

  const done = new Promise<{ answer: string; thinking: string; blocks: ChatBlock[] }>((resolve, reject) => {
    finishHandlers = finish(resolve, reject);

    ws.onmessage = (event) => {
      let data: ChatStreamEvent;
      try {
        data = JSON.parse(event.data as string) as ChatStreamEvent;
      } catch {
        return;
      }

      callbacks.onEvent?.(data);

      switch (data.type) {
        case "chat.ready":
          readyReceived = true;
          callbacks.onReady?.(data as ChatReadyEvent);
          ws.send(
            JSON.stringify({
              type: "chat.send",
              content,
              ...(options?.excludeServers?.length
                ? { exclude_servers: options.excludeServers }
                : {}),
            })
          );
          return;
        case "thinking_token":
          if ("token" in data && typeof data.token === "string") {
            thinking += data.token;
            callbacks.onThinkingToken?.(data.token);
          }
          break;
        case "assistant_response_token":
          if ("token" in data && typeof data.token === "string") {
            answer += data.token;
            callbacks.onResponseToken?.(data.token);
          }
          break;
        case "section":
          if ("section" in data && "action" in data) {
            callbacks.onSection?.(data.section as string, data.action as "open" | "close");
          }
          break;
        case "tool_calls":
          if ("names" in data && Array.isArray(data.names)) {
            callbacks.onToolCalls?.(data.names as string[]);
          }
          break;
        case "tool_completed":
          if ("tool_name" in data && "tool_call_id" in data && "ok" in data) {
            callbacks.onToolCompleted?.(
              data.tool_name as string,
              data.tool_call_id as string,
              Boolean(data.ok)
            );
          }
          break;
        case "chat.compressed":
          callbacks.onCompressed?.();
          break;
        case "chat.done": {
          turnCompleted = true;
          blocks = finalizeAssistantBlocks(blocks);
          emitBlocks();
          callbacks.onDone?.();
          finishHandlers?.resolve({ answer, thinking, blocks });
          return;
        }
        case "chat.cancelled":
          turnCompleted = true;
          blocks = finalizeAssistantBlocks(blocks);
          emitBlocks();
          callbacks.onCancelled?.();
          finishHandlers?.resolve({ answer, thinking, blocks });
          return;
        case "error":
          callbacks.onError?.((data as { message: string }).message);
          finishHandlers?.reject(new Error((data as { message: string }).message));
          return;
        default:
          break;
      }

      applyEventToBlocks(data);
    };

    ws.onerror = () => {
      if (!settled) {
        finishHandlers?.reject(new Error("WebSocket connection failed"));
      }
    };

    ws.onclose = (event) => {
      if (settled || turnCompleted) return;
      const detail =
        event.reason?.trim() ||
        (event.code ? `code ${event.code}` : "connection closed");
      if (!readyReceived) {
        finishHandlers?.reject(
          new Error(
            `Chat WebSocket closed before ready (${detail}). Check workspace exists and Vite /ws proxy.`
          )
        );
        return;
      }
      finishHandlers?.reject(
        new Error(`Chat WebSocket closed before the turn finished (${detail})`)
      );
    };

    timeoutId = window.setTimeout(() => {
      finishHandlers?.reject(new Error("Chat request timed out"));
    }, 300_000);
  });

  void done.finally(() => {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  });

  return {
    cancel: () => {
      if (settled) return;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "chat.cancel" }));
      }
      finishHandlers?.reject(new Error("Chat cancelled"));
      ws.close();
    },
    done,
  };
}

export async function sendChatMessage(
  content: string,
  callbacks?: ChatStreamCallbacks,
  workspaceName?: string
): Promise<{ answer: string; provenance: ProvenanceEntry[]; workspace: string }> {
  if (!workspaceName?.trim()) {
    throw new Error("Workspace is required for chat.");
  }
  const chatKey = resolveChatKey("workspace", workspaceName, null);
  const { done } = sendChatTurn(chatKey, content, callbacks);
  const { answer } = await done;
  const detail = await getChat("workspace", workspaceName, null);
  return {
    answer,
    provenance: [],
    workspace: detail.workspace ?? workspaceName,
  };
}
