import type { ChatMessage, ProvenanceEntry } from "@/database/workspaceStorage";
import { buildApiUrl, wsBaseUrl } from "@/database/apiUrl";
import type { ChatBlock, ChatTurn } from "@/lib/chatTypes";
import {
  applyStreamEvent,
  finalizeAssistantBlocks,
  messagesToTurns,
} from "@/lib/chatStreamReducer";
import { readMigratedLocalStorage } from "@/lib/migrateStorageKey";

/**
 * WebSocket path segment and logical key for flagged-scope chat.
 * Separate thread from any per-workspace chat (even if that workspace is starred).
 */
export const FLAGGED_CHAT_KEY = "flagged";

/** @deprecated Use FLAGGED_CHAT_KEY */
export const GLOBAL_CHAT_WORKSPACE = FLAGGED_CHAT_KEY;

export type ChatScope = "workspace" | "global";

const CHAT_SCOPE_KEY = "nodepoint_chat_scope";
const CHAT_WORKSPACE_KEY = "nodepoint_chat_workspace";
const LEGACY_CHAT_SCOPE_KEY = "prajna_chat_scope";
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

export interface ChatSummaryFlaggedResponse {
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

export function getStoredChatScope(): ChatScope {
  try {
    const v = readMigratedLocalStorage(CHAT_SCOPE_KEY, LEGACY_CHAT_SCOPE_KEY);
    if (v === "global" || v === "flagged") return "global";
    return "workspace";
  } catch {
    return "workspace";
  }
}

export function setStoredChatScope(scope: ChatScope): void {
  try {
    localStorage.setItem(CHAT_SCOPE_KEY, scope);
  } catch {
    /* ignore */
  }
}

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
export function resolveChatKey(scope: ChatScope, workspaceName: string | null): string {
  if (scope === "global") return FLAGGED_CHAT_KEY;
  if (!workspaceName?.trim()) {
    throw new Error("Select a workspace for workspace-scoped chat.");
  }
  return workspaceName.trim();
}

/** @deprecated Use resolveChatKey */
export function resolveChatWorkspaceKey(
  scope: ChatScope,
  workspaceName: string | null
): string {
  return resolveChatKey(scope, workspaceName);
}

function flaggedChatRestUrl(): string {
  return buildApiUrl("/chat/", { flagged: "true" });
}

export async function getChat(
  scope: ChatScope,
  workspaceName: string | null
): Promise<WorkspaceChatResponse> {
  const response = await fetch(chatRestUrl(scope, workspaceName));
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return response.json();
}

/** @deprecated Use getChat */
export async function getWorkspaceChat(workspaceKey: string): Promise<WorkspaceChatResponse> {
  if (workspaceKey === FLAGGED_CHAT_KEY) {
    return getChat("global", null);
  }
  return getChat("workspace", workspaceKey);
}

function chatRestUrl(scope: ChatScope, workspaceName: string | null): string {
  if (scope === "global") return flaggedChatRestUrl();
  const name = workspaceName?.trim();
  if (!name) throw new Error("Select a workspace for workspace-scoped chat.");
  return buildApiUrl(`/chat/${encodeWorkspaceKey(name)}/`);
}

export async function clearChat(
  scope: ChatScope,
  workspaceName: string | null
): Promise<ClearChatResponse> {
  const response = await fetch(chatRestUrl(scope, workspaceName), { method: "DELETE" });
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return response.json();
}

/** @deprecated Use clearChat */
export async function clearWorkspaceChat(workspaceKey: string): Promise<ClearChatResponse> {
  if (workspaceKey === FLAGGED_CHAT_KEY) {
    return clearChat("global", null);
  }
  return clearChat("workspace", workspaceKey);
}

export async function getChatSummary(
  params: { workspaceName: string } | { flagged: true }
): Promise<ChatSummaryEntry | ChatSummaryFlaggedResponse> {
  const searchParams = new URLSearchParams();
  if ("flagged" in params) {
    searchParams.set("flagged", "true");
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
  scope: ChatScope,
  workspaceName: string | null
): Promise<{
  chatKey: string;
  scope: ChatScope;
  workspace: string;
  isFlag: boolean;
  turns: ChatTurn[];
}> {
  const chatKey = resolveChatKey(scope, workspaceName);
  const detail = await getChat(scope, workspaceName);
  const workspace =
    detail.workspace ??
    (scope === "global" ? "flagged (all starred)" : workspaceName ?? chatKey);
  return {
    chatKey,
    scope,
    workspace,
    isFlag: Boolean(detail.is_flag ?? detail.flagged),
    turns: messagesToTurns(detail.messages),
  };
}

/** @deprecated Use loadChatTurns(scope, workspaceName) */
export async function loadChatTurnsByKey(workspaceKey: string): Promise<{
  workspaceKey: string;
  workspace: string;
  isFlag: boolean;
  turns: ChatTurn[];
}> {
  const scope: ChatScope = workspaceKey === FLAGGED_CHAT_KEY ? "global" : "workspace";
  const result = await loadChatTurns(
    scope,
    scope === "workspace" ? workspaceKey : null
  );
  return {
    workspaceKey: result.chatKey,
    workspace: result.workspace,
    isFlag: result.isFlag,
    turns: result.turns,
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
  scope: ChatScope,
  workspaceName: string | null
): Promise<ChatMessage[]> {
  const detail = await getChat(scope, workspaceName);
  return chatMessagesToLegacy(detail.messages);
}

function chatWebSocketUrl(chatKey: string): string {
  return `${wsBaseUrl()}/ws/chat/${encodeWorkspaceKey(chatKey)}/`;
}

export function sendChatTurn(
  workspaceKey: string,
  content: string,
  callbacks: ChatStreamCallbacks = {},
  options?: { excludeServers?: string[] }
): { cancel: () => void; done: Promise<{ answer: string; thinking: string; blocks: ChatBlock[] }> } {
  const ws = new WebSocket(chatWebSocketUrl(workspaceKey));
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
  const chatKey = resolveChatKey("workspace", workspaceName);
  const { done } = sendChatTurn(chatKey, content, callbacks);
  const { answer } = await done;
  const detail = await getChat("workspace", workspaceName);
  return {
    answer,
    provenance: [],
    workspace: detail.workspace ?? workspaceName,
  };
}
