import type { ChatMessage, GroupTag, ProvenanceEntry } from "@/database/workspaceStorage";
import { wsBaseUrl } from "@/database/apiUrl";
import { apiFetch, getAccessToken, parseErrorResponse } from "@/database/apiClient";
import type { ChatBlock, ChatTurn } from "@/lib/chatTypes";
import {
  finalizeAssistantBlocks,
  messagesToTurns,
} from "@/lib/chatStreamReducer";
import { ChatWebSocketClient } from "@/lib/chatWebSocket";
import { readMigratedLocalStorage } from "@/lib/migrateStorageKey";
import {
  appendOwnerQuery,
  appendOwnerQueryParts,
  type OwnerParams,
} from "@/lib/ownerScope";
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
const ACTIVE_SESSION_PREFIX = "nodepoint_active_session_";
const INCOGNITO_PREFIX = "nodepoint_incognito_";

function encodeWorkspaceKey(workspaceKey: string): string {
  return encodeURIComponent(workspaceKey);
}

// --- Session REST types ---

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

export interface ChatSessionMeta {
  session_id: string;
  title: string;
  created_at: string;
  updated_at?: string;
  message_count?: number;
}

export interface ChatSessionDetail {
  workspace?: string;
  group?: string;
  session_id: string;
  title: string;
  messages: ChatMessageRecord[];
}

export interface ChatSessionsListResponse {
  workspace?: string;
  group?: string;
  sessions: ChatSessionMeta[];
}

export interface CreateChatSessionResponse {
  workspace?: string;
  group?: string;
  session_id: string;
  title: string;
  created_at: string;
}

export interface ClearChatSessionResponse {
  message: string;
  session_id: string;
}

export interface ChatSummaryEntry {
  workspace: string;
  is_flag: boolean;
  updated_at: string | null;
  message_count: number;
}

export interface ChatSummaryGroupChatBlock {
  updated_at: string | null;
  message_count: number;
}

export interface ChatSummaryGroupResponse {
  group: string;
  tag?: GroupTag;
  member_count?: number;
  group_chat?: ChatSummaryGroupChatBlock;
  workspaces?: ChatSummaryEntry[];
}

export interface ChatSummaryGroupResponseLegacy {
  workspaces: ChatSummaryEntry[];
}

// --- WebSocket connect mode ---

export type ChatConnectMode =
  | { kind: "session"; sessionId: string }
  | { kind: "incognito" };

export interface ChatPartialSaved {
  content?: string;
  message_id?: string;
}

// --- WebSocket event types ---

export type ChatStreamEvent =
  | ChatReadyEvent
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
  | { type: "chat.compress_started"; message?: string }
  | { type: "chat.compress_completed"; message?: string; summary_chars?: number }
  | { type: "chat.compress_failed"; message?: string }
  | ChatReconnectedEvent
  | ChatStatusEvent
  | { type: "chat.branch_updated"; active_branch_id?: string }
  | { type: "chat.turn_started"; turn_id?: string }
  | { type: "chat.queued"; message?: string }
  | ChatInterruptedEvent
  | ChatCancelledEvent
  | { type: "chat.done" }
  | ChatErrorEvent
  | { type: string; [key: string]: unknown };

export interface ChatReadyEvent {
  type: "chat.ready";
  workspace?: string;
  group?: string;
  tag?: GroupTag;
  members?: unknown[];
  member_count?: number;
  workspaces?: string[];
  session_id?: string;
  conversation_id?: string;
  incognito?: boolean;
  active_branch_id?: string;
  agent_busy?: boolean;
  turn_id?: string;
  turn_started_at?: string;
  reconnect_hint?: string;
}

export interface ChatReconnectedEvent {
  type: "chat.reconnected";
  agent_busy: boolean;
  turn_id?: string;
  hint?: string;
}

export interface ChatStatusEvent {
  type: "chat.status";
  agent_busy?: boolean;
  turn_id?: string;
  turn_started_at?: string;
}

export interface ChatInterruptedEvent {
  type: "chat.interrupted";
  saved?: ChatPartialSaved;
}

export interface ChatCancelledEvent {
  type: "chat.cancelled";
  saved?: ChatPartialSaved;
}

export interface ChatErrorEvent {
  type: "error";
  message: string;
  code?: string;
}

export type ChatLiveAttachEvent = ChatReadyEvent | ChatReconnectedEvent;

export interface ChatStreamCallbacks {
  onReady?: (event: ChatReadyEvent) => void;
  onThinkingToken?: (token: string) => void;
  onResponseToken?: (token: string) => void;
  onSection?: (section: string, action: "open" | "close") => void;
  onToolCalls?: (names: string[]) => void;
  onToolCompleted?: (toolName: string, toolCallId: string, ok: boolean) => void;
  onBlocksChange?: (blocks: ChatBlock[]) => void;
  onCompressed?: () => void;
  onCancelled?: (saved?: ChatPartialSaved) => void;
  onInterrupted?: (saved?: ChatPartialSaved) => void;
  onQueued?: (message?: string) => void;
  onEvent?: (event: ChatStreamEvent) => void;
  onDone?: () => void;
  onError?: (message: string, code?: string) => void;
}

export type { ChatBlock, ChatTurn };
export { messagesToTurns, finalizeAssistantBlocks };

export function sessionDisplayTitle(title: string | undefined | null): string {
  const t = title?.trim();
  return t && t.length > 0 ? t : "Untitled";
}

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

export function getStoredActiveSessionId(chatKey: string): string | null {
  try {
    return localStorage.getItem(`${ACTIVE_SESSION_PREFIX}${chatKey}`);
  } catch {
    return null;
  }
}

export function setStoredActiveSessionId(
  chatKey: string,
  sessionId: string | null
): void {
  try {
    const key = `${ACTIVE_SESSION_PREFIX}${chatKey}`;
    if (sessionId) {
      localStorage.setItem(key, sessionId);
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

export function getStoredIncognito(chatKey: string): boolean {
  try {
    return localStorage.getItem(`${INCOGNITO_PREFIX}${chatKey}`) === "1";
  } catch {
    return false;
  }
}

export function setStoredIncognito(chatKey: string, incognito: boolean): void {
  try {
    const key = `${INCOGNITO_PREFIX}${chatKey}`;
    if (incognito) {
      localStorage.setItem(key, "1");
    } else {
      localStorage.removeItem(key);
    }
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

function sessionsRestBase(
  mode: ViewScopeMode,
  workspaceName: string | null,
  groupName: string | null
): string {
  if (mode === "group") {
    if (!groupName?.trim() || !isSelectableGroup(groupName)) {
      throw new Error("Select a group for group-scoped chat.");
    }
    return `/chat/group/${encodeWorkspaceKey(groupName.trim())}/sessions/`;
  }
  const name = workspaceName?.trim();
  if (!name) throw new Error("Select a workspace for workspace-scoped chat.");
  return `/chat/${encodeWorkspaceKey(name)}/sessions/`;
}

function sessionRestUrl(
  mode: ViewScopeMode,
  workspaceName: string | null,
  groupName: string | null,
  sessionId: string,
  suffix = ""
): string {
  const base = sessionsRestBase(mode, workspaceName, groupName);
  return `${base.replace(/\/$/, "")}/${encodeURIComponent(sessionId)}${suffix}`;
}

export async function listChatSessions(
  mode: ViewScopeMode,
  workspaceName: string | null,
  groupName: string | null,
  owner?: OwnerParams
): Promise<ChatSessionMeta[]> {
  const response = await apiFetch(
    sessionsRestBase(mode, workspaceName, groupName),
    {},
    appendOwnerQuery({}, owner)
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  const data = await response.json();
  if (Array.isArray(data)) return data as ChatSessionMeta[];
  if (data && Array.isArray(data.sessions)) {
    return data.sessions as ChatSessionMeta[];
  }
  return [];
}

export async function createChatSession(
  mode: ViewScopeMode,
  workspaceName: string | null,
  groupName: string | null,
  options?: { title?: string },
  owner?: OwnerParams
): Promise<CreateChatSessionResponse> {
  const response = await apiFetch(
    sessionsRestBase(mode, workspaceName, groupName),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        options?.title?.trim() ? { title: options.title.trim() } : {}
      ),
    },
    appendOwnerQuery({}, owner)
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return response.json();
}

export async function getChatSession(
  mode: ViewScopeMode,
  workspaceName: string | null,
  groupName: string | null,
  sessionId: string,
  owner?: OwnerParams
): Promise<ChatSessionDetail> {
  const response = await apiFetch(
    sessionRestUrl(mode, workspaceName, groupName, sessionId),
    {},
    appendOwnerQuery({}, owner)
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return response.json();
}

export async function renameChatSession(
  mode: ViewScopeMode,
  workspaceName: string | null,
  groupName: string | null,
  sessionId: string,
  title: string,
  owner?: OwnerParams
): Promise<ChatSessionDetail> {
  const response = await apiFetch(
    sessionRestUrl(mode, workspaceName, groupName, sessionId),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() }),
    },
    appendOwnerQuery({}, owner)
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return response.json();
}

export async function deleteChatSession(
  mode: ViewScopeMode,
  workspaceName: string | null,
  groupName: string | null,
  sessionId: string,
  owner?: OwnerParams
): Promise<void> {
  const response = await apiFetch(
    sessionRestUrl(mode, workspaceName, groupName, sessionId),
    { method: "DELETE" },
    appendOwnerQuery({}, owner)
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
}

export async function clearChatSessionMessages(
  mode: ViewScopeMode,
  workspaceName: string | null,
  groupName: string | null,
  sessionId: string,
  owner?: OwnerParams
): Promise<ClearChatSessionResponse> {
  const response = await apiFetch(
    sessionRestUrl(mode, workspaceName, groupName, sessionId, "/clear/"),
    { method: "POST" },
    appendOwnerQuery({}, owner)
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return response.json();
}

export async function getChatSummary(
  params:
    | ({ workspaceName: string } & OwnerParams)
    | ({ group: string } & OwnerParams)
): Promise<ChatSummaryEntry | ChatSummaryGroupResponse> {
  const query: Record<string, string> = {};
  if ("group" in params) {
    query.group = params.group;
  } else {
    query.workspace_name = params.workspaceName;
  }
  const response = await apiFetch(
    "/chat/summary/",
    {},
    appendOwnerQuery(query, params)
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return response.json();
}

export async function loadChatTurns(
  mode: ViewScopeMode,
  workspaceName: string | null,
  groupName: string | null,
  sessionId: string,
  owner?: OwnerParams
): Promise<{
  chatKey: string;
  mode: ViewScopeMode;
  workspace: string;
  sessionId: string;
  title: string;
  turns: ChatTurn[];
}> {
  const chatKey = resolveChatKey(mode, workspaceName, groupName);
  const detail = await getChatSession(
    mode,
    workspaceName,
    groupName,
    sessionId,
    owner
  );
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
    sessionId: detail.session_id,
    title: detail.title,
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

function chatWebSocketPath(chatKey: string): string {
  if (isGroupChatKey(chatKey)) {
    const name = groupNameFromChatKey(chatKey);
    return `group/${encodeWorkspaceKey(name)}/`;
  }
  return `${encodeWorkspaceKey(chatKey)}/`;
}

export function chatWebSocketUrl(
  chatKey: string,
  connect: ChatConnectMode,
  owner?: OwnerParams
): string {
  const base = `${wsBaseUrl()}/ws/chat/${chatWebSocketPath(chatKey)}`;
  const parts: string[] =
    connect.kind === "incognito"
      ? ["incognito=true"]
      : [`session_id=${encodeURIComponent(connect.sessionId)}`];
  appendOwnerQueryParts(parts, owner);
  const token = getAccessToken();
  if (token) {
    parts.push(`token=${encodeURIComponent(token)}`);
  }
  return `${base}?${parts.join("&")}`;
}

export function resolveChatConnectMode(
  incognito: boolean,
  sessionId: string | null
): ChatConnectMode {
  if (incognito) return { kind: "incognito" };
  if (!sessionId?.trim()) {
    throw new Error("Select or create a chat session.");
  }
  return { kind: "session", sessionId: sessionId.trim() };
}

export function sendChatTurn(
  chatKey: string,
  connect: ChatConnectMode,
  content: string,
  callbacks: ChatStreamCallbacks = {},
  options?: { excludeServers?: string[]; owner?: OwnerParams }
): { cancel: () => void; done: Promise<{ answer: string; thinking: string; blocks: ChatBlock[] }> } {
  const client = new ChatWebSocketClient(
    chatKey,
    connect,
    callbacks,
    options?.owner
  );
  client.connect();

  const done = client.sendChat(content, options).finally(() => {
    client.destroy();
  });

  return {
    cancel: () => client.cancelTurn({ destroy: true }),
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
  const sessions = await listChatSessions("workspace", workspaceName, null);
  let sessionId = getStoredActiveSessionId(chatKey);
  if (!sessionId || !sessions.some((s) => s.session_id === sessionId)) {
    if (sessions.length > 0) {
      sessionId = sessions[0].session_id;
    } else {
      const created = await createChatSession("workspace", workspaceName, null);
      sessionId = created.session_id;
    }
    setStoredActiveSessionId(chatKey, sessionId);
  }
  const connect: ChatConnectMode = { kind: "session", sessionId };
  const { done } = sendChatTurn(chatKey, connect, content, callbacks);
  const { answer } = await done;
  const detail = await getChatSession("workspace", workspaceName, null, sessionId);
  return {
    answer,
    provenance: [],
    workspace: detail.workspace ?? workspaceName,
  };
}
