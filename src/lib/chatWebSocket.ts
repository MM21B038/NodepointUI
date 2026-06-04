import type { ChatBlock } from "@/lib/chatTypes";
import {
  applyStreamEvent,
  finalizeAssistantBlocks,
} from "@/lib/chatStreamReducer";
import type {
  ChatCancelledEvent,
  ChatConnectMode,
  ChatInterruptedEvent,
  ChatLiveAttachEvent,
  ChatPartialSaved,
  ChatReadyEvent,
  ChatReconnectedEvent,
  ChatStreamCallbacks,
  ChatStreamEvent,
  ChatStatusEvent,
} from "@/database/chatStorage";
import { getAccessToken, notifySessionExpired } from "@/database/apiClient";
import { chatWebSocketUrl } from "@/database/chatStorage";
import type { OwnerParams } from "@/lib/ownerScope";
import { pickRicherBlocks } from "@/lib/chatStreamReducer";
import { rafThrottle, type RafThrottled } from "@/lib/rafThrottle";

export type ChatConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

export type { ChatLiveAttachEvent, ChatReadyEvent, ChatReconnectedEvent };

export interface ChatWebSocketCallbacks extends ChatStreamCallbacks {
  onConnectionStateChange?: (state: ChatConnectionState) => void;
  onAgentBusyChange?: (busy: boolean) => void;
  onQueuedChange?: (queued: boolean) => void;
  onReconnecting?: (attempt: number) => void;
  /** Fired when `agent_busy` is true on `chat.ready` or `chat.reconnected` (live stream attach). */
  onLiveAttach?: (event: ChatLiveAttachEvent) => void;
  onReconnected?: (event: ChatReconnectedEvent) => void;
  onTurnStarted?: (turnId?: string) => void;
  onCompressStarted?: (message?: string) => void;
  onCompressCompleted?: (message?: string, summaryChars?: number) => void;
  onCompressFailed?: (message?: string) => void;
}

export interface SendChatTurnResult {
  answer: string;
  thinking: string;
  blocks: ChatBlock[];
  saved?: ChatPartialSaved;
}

const PING_INTERVAL_MS = 25_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 20_000;
const MAX_RECONNECT_ATTEMPTS = 12;
const CONNECTION_WAIT_MS = 15_000;

function parseSaved(data: ChatStreamEvent): ChatPartialSaved | undefined {
  if ("saved" in data && data.saved && typeof data.saved === "object") {
    const s = data.saved as ChatPartialSaved;
    return s;
  }
  return undefined;
}

function dispatchStreamEvent(
  data: ChatStreamEvent,
  callbacks: ChatWebSocketCallbacks,
  applyBlock: (data: ChatStreamEvent) => void,
  onTurnStarted: () => void
): "done" | "cancelled" | "error" | "interrupted" | void {
  callbacks.onEvent?.(data);

  switch (data.type) {
    case "thinking_token":
      if ("token" in data && typeof data.token === "string") {
        callbacks.onThinkingToken?.(data.token);
      }
      applyBlock(data);
      break;
    case "assistant_response_token":
      if ("token" in data && typeof data.token === "string") {
        callbacks.onResponseToken?.(data.token);
      }
      applyBlock(data);
      break;
    case "section":
      if ("section" in data && "action" in data) {
        callbacks.onSection?.(
          data.section as string,
          data.action as "open" | "close"
        );
      }
      applyBlock(data);
      break;
    case "tool_calls":
      if ("names" in data && Array.isArray(data.names)) {
        callbacks.onToolCalls?.(data.names as string[]);
      }
      applyBlock(data);
      break;
    case "tool_completed":
      if ("tool_name" in data && "tool_call_id" in data && "ok" in data) {
        callbacks.onToolCompleted?.(
          data.tool_name as string,
          data.tool_call_id as string,
          Boolean(data.ok)
        );
      }
      applyBlock(data);
      break;
    case "chat.compressed":
      callbacks.onCompressed?.();
      break;
    case "chat.compress_started":
      callbacks.onCompressStarted?.(
        "message" in data ? String(data.message) : undefined
      );
      break;
    case "chat.compress_completed":
      callbacks.onCompressCompleted?.(
        "message" in data ? String(data.message) : undefined,
        "summary_chars" in data ? Number(data.summary_chars) : undefined
      );
      break;
    case "chat.compress_failed":
      callbacks.onCompressFailed?.(
        "message" in data ? String(data.message) : undefined
      );
      break;
    case "chat.queued":
      callbacks.onQueued?.(
        "message" in data ? String(data.message) : undefined
      );
      break;
    case "chat.turn_started":
      onTurnStarted();
      callbacks.onTurnStarted?.(
        "turn_id" in data ? String(data.turn_id) : undefined
      );
      break;
    case "chat.done":
      callbacks.onDone?.();
      return "done";
    case "chat.cancelled":
      callbacks.onCancelled?.(parseSaved(data));
      return "cancelled";
    case "chat.interrupted":
      callbacks.onInterrupted?.(parseSaved(data));
      return "interrupted";
    case "error": {
      const code = "code" in data ? String(data.code) : undefined;
      callbacks.onError?.(
        "message" in data ? String(data.message) : "Unknown error",
        code
      );
      return "error";
    }
    default:
      applyBlock(data);
      break;
  }
}

export class ChatWebSocketClient {
  private ws: WebSocket | null = null;
  private readonly callbacks: ChatWebSocketCallbacks;
  private readonly chatKey: string;
  private readonly connectMode: ChatConnectMode;
  private readonly owner?: OwnerParams;

  private connectionState: ChatConnectionState = "disconnected";
  private agentBusy = false;
  private turnQueued = false;
  private intentionalClose = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private pingTimer: ReturnType<typeof setInterval> | undefined;

  private readyReceived = false;
  private pendingReconnectHandshake = false;
  private activeTurn = false;

  private blocks: ChatBlock[] = [];
  private thinking = "";
  private answer = "";
  private lastSaved: ChatPartialSaved | undefined;

  private turnResolve: ((v: SendChatTurnResult) => void) | null = null;
  private turnReject: ((e: Error) => void) | null = null;
  private readonly emitBlocksThrottled: RafThrottled<() => void>;

  constructor(
    chatKey: string,
    connect: ChatConnectMode,
    callbacks: ChatWebSocketCallbacks = {},
    owner?: OwnerParams
  ) {
    this.chatKey = chatKey;
    this.connectMode = connect;
    this.owner = owner;
    this.callbacks = callbacks;
    this.emitBlocksThrottled = rafThrottle(() => {
      this.callbacks.onBlocksChange?.([...this.blocks]);
    });
  }

  getConnectionState(): ChatConnectionState {
    return this.connectionState;
  }

  isAgentBusy(): boolean {
    return this.agentBusy;
  }

  isTurnQueued(): boolean {
    return this.turnQueued;
  }

  getBlocks(): ChatBlock[] {
    return this.blocks;
  }

  getLastSaved(): ChatPartialSaved | undefined {
    return this.lastSaved;
  }

  /** Prefer the richer snapshot (UI catch-up during reconnect). */
  hydrateBlocks(blocks: ChatBlock[]): void {
    const merged = pickRicherBlocks(this.blocks, blocks);
    if (merged.length) {
      this.blocks = merged;
    }
  }

  /** Push the latest blocks immediately (after reconnect, not throttled). */
  flushBlockEmit(): void {
    this.emitBlocksThrottled.cancel();
    this.callbacks.onBlocksChange?.([...this.blocks]);
  }

  connect(): void {
    this.intentionalClose = false;
    this.openSocket();
  }

  destroy(): void {
    this.intentionalClose = true;
    this.emitBlocksThrottled.cancel();
    this.clearTimers();
    this.rejectActiveTurn(new Error("Chat connection closed"));
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close();
      }
      this.ws = null;
    }
    this.setConnectionState("disconnected");
    this.setAgentBusy(false);
    this.setTurnQueued(false);
  }

  /** Ask the server to stop the current agent turn (no local promise rejection). */
  requestCancel(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "chat.cancel" }));
    }
  }

  cancelTurn(options?: { destroy?: boolean }): void {
    this.requestCancel();
    if (options?.destroy !== false) {
      this.destroy();
    }
  }

  sendChat(
    content: string,
    options?: { excludeServers?: string[] }
  ): Promise<SendChatTurnResult> {
    if (this.agentBusy || this.activeTurn) {
      return Promise.reject(
        new Error("Agent is busy. Wait for the current turn to finish.")
      );
    }

    return new Promise<SendChatTurnResult>((resolve, reject) => {
      this.turnResolve = resolve;
      this.turnReject = reject;
      this.activeTurn = true;
      this.lastSaved = undefined;
      this.blocks = [];
      this.thinking = "";
      this.answer = "";
      this.emitBlocks();

      void this.ensureConnected()
        .then(() => {
          if (this.agentBusy) {
            throw new Error("Agent is busy. Wait for the current turn to finish.");
          }
          this.ws?.send(
            JSON.stringify({
              type: "chat.send",
              content,
              ...(options?.excludeServers?.length
                ? { exclude_servers: options.excludeServers }
                : {}),
            })
          );
        })
        .catch((err) => {
          this.finishTurn(
            undefined,
            err instanceof Error ? err : new Error(String(err))
          );
        });
    });
  }

  requestReconnect(): void {
    if (this.ws?.readyState === WebSocket.OPEN && this.readyReceived) {
      this.ws.send(JSON.stringify({ type: "chat.reconnect" }));
      this.pendingReconnectHandshake = true;
    }
  }

  private openSocket(): void {
    if (this.intentionalClose) return;

    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      if (this.ws.readyState === WebSocket.OPEN) return;
      if (this.ws.readyState === WebSocket.CONNECTING) return;
    }

    if (!getAccessToken()) {
      notifySessionExpired();
      this.setConnectionState("disconnected");
      if (this.turnReject) {
        this.finishTurn(
          undefined,
          new Error("Sign in required to use chat.")
        );
      }
      return;
    }

    this.setConnectionState(
      this.reconnectAttempts > 0 ? "reconnecting" : "connecting"
    );

    const ws = new WebSocket(
      chatWebSocketUrl(this.chatKey, this.connectMode, this.owner)
    );
    this.ws = ws;

    ws.onopen = () => {
      this.armPing();
    };

    ws.onmessage = (event) => {
      let data: ChatStreamEvent;
      try {
        data = JSON.parse(event.data as string) as ChatStreamEvent;
      } catch {
        return;
      }
      this.handleMessage(data);
    };

    ws.onerror = () => {
      if (!this.readyReceived && !this.activeTurn) {
        this.finishTurn(undefined, new Error("WebSocket connection failed"));
      }
    };

    ws.onclose = (event) => {
      this.clearPing();
      this.readyReceived = false;
      const wasStreaming = this.activeTurn || this.agentBusy;

      if (this.intentionalClose) {
        this.setConnectionState("disconnected");
        return;
      }

      if (event.code === 4401) {
        notifySessionExpired();
        this.setConnectionState("disconnected");
        this.finishTurn(
          undefined,
          new Error("Session expired. Please sign in again.")
        );
        return;
      }

      if (wasStreaming) {
        this.scheduleReconnect(
          event.reason?.trim() ||
            (event.code ? `code ${event.code}` : "connection lost")
        );
        return;
      }

      this.setConnectionState("disconnected");
      if (this.turnReject) {
        this.finishTurn(
          undefined,
          new Error(
            event.reason?.trim() ||
              `WebSocket closed (${event.code || "unknown"})`
          )
        );
      }
    };
  }

  private handleMessage(data: ChatStreamEvent): void {
    if (data.type === "pong") return;

    if (data.type === "chat.ready") {
      this.onChatReady(data as ChatReadyEvent);
      return;
    }

    if (data.type === "chat.reconnected") {
      this.onChatReconnected(data as ChatReconnectedEvent);
      return;
    }

    if (data.type === "chat.status") {
      const status = data as ChatStatusEvent;
      const busy = Boolean(status.agent_busy);
      this.setAgentBusy(busy);
      if (!busy && !this.turnReject) {
        this.activeTurn = false;
        this.setConnectionState("connected");
      }
      return;
    }

    if (data.type === "chat.branch_updated") {
      this.callbacks.onEvent?.(data);
      return;
    }

    const outcome = dispatchStreamEvent(
      data,
      this.callbacks,
      (evt) => this.applyEventToBlocks(evt),
      () => this.onTurnStartedFromServer()
    );

    if (data.type === "chat.queued") {
      this.setTurnQueued(true);
    }

    if (
      outcome === "done" ||
      outcome === "cancelled" ||
      outcome === "interrupted"
    ) {
      const saved =
        outcome === "cancelled"
          ? parseSaved(data as ChatCancelledEvent)
          : outcome === "interrupted"
            ? parseSaved(data as ChatInterruptedEvent)
            : undefined;
      if (saved) this.lastSaved = saved;

      this.blocks = finalizeAssistantBlocks(this.blocks);
      this.emitBlocks();
      this.setAgentBusy(false);
      this.setTurnQueued(false);
      this.finishTurn({
        answer: this.answer,
        thinking: this.thinking,
        blocks: this.blocks,
        saved: this.lastSaved,
      });
      return;
    }

    if (outcome === "error") {
      this.setAgentBusy(false);
      this.setTurnQueued(false);
      const code = "code" in data ? String(data.code) : undefined;
      this.finishTurn(
        undefined,
        new Error(
          "message" in data ? String(data.message) : "Stream error"
        ),
        code
      );
    }
  }

  private onTurnStartedFromServer(): void {
    this.setTurnQueued(false);
  }

  private onChatReady(event: ChatReadyEvent): void {
    this.readyReceived = true;
    this.setConnectionState("connected");
    this.callbacks.onReady?.(event);

    const busy = Boolean(event.agent_busy);
    this.setAgentBusy(busy);

    if (busy) {
      this.activeTurn = true;
      this.callbacks.onLiveAttach?.(event);
    }

    if (this.pendingReconnectHandshake) {
      this.ws?.send(JSON.stringify({ type: "chat.reconnect" }));
      this.pendingReconnectHandshake = false;
    }
  }

  private onChatReconnected(event: ChatReconnectedEvent): void {
    this.reconnectAttempts = 0;
    this.setConnectionState("connected");
    this.setAgentBusy(Boolean(event.agent_busy));
    this.callbacks.onReconnected?.(event);

    if (event.agent_busy) {
      this.activeTurn = true;
      this.ws?.send(JSON.stringify({ type: "chat.status" }));
      this.flushBlockEmit();
      this.callbacks.onLiveAttach?.(event);
    } else {
      this.activeTurn = false;
    }
  }

  private scheduleReconnect(reason: string): void {
    if (this.intentionalClose) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.setConnectionState("disconnected");
      const message = `Could not reconnect (${reason}). The agent may still be running — refresh the page.`;
      this.callbacks.onError?.(message);
      this.activeTurn = false;
      this.setAgentBusy(false);
      this.setTurnQueued(false);
      this.finishTurn(undefined, new Error(message));
      return;
    }

    this.reconnectAttempts += 1;
    this.pendingReconnectHandshake = true;
    this.setConnectionState("reconnecting");
    this.callbacks.onReconnecting?.(this.reconnectAttempts);

    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** (this.reconnectAttempts - 1),
      RECONNECT_MAX_MS
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.openSocket();
    }, delay);
  }

  private ensureConnected(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN && this.readyReceived) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        if (this.intentionalClose) {
          reject(new Error("Connection closed"));
          return;
        }
        if (this.ws?.readyState === WebSocket.OPEN && this.readyReceived) {
          resolve();
          return;
        }
        if (Date.now() - started > CONNECTION_WAIT_MS) {
          reject(new Error("Timed out waiting for chat connection"));
          return;
        }
        setTimeout(tick, 100);
      };
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        this.openSocket();
      }
      tick();
    });
  }

  private applyEventToBlocks(data: ChatStreamEvent): void {
    this.blocks = applyStreamEvent(this.blocks, data);
    this.emitBlocks();
  }

  private emitBlocks(): void {
    if (this.activeTurn || this.agentBusy) {
      this.emitBlocksThrottled();
      return;
    }
    this.callbacks.onBlocksChange?.([...this.blocks]);
  }

  private finishTurn(
    result?: SendChatTurnResult,
    error?: Error,
    _code?: string
  ): void {
    this.activeTurn = false;
    this.setTurnQueued(false);

    if (error) {
      this.turnReject?.(error);
    } else if (result) {
      this.turnResolve?.(result);
    }

    this.turnResolve = null;
    this.turnReject = null;
  }

  private rejectActiveTurn(error: Error): void {
    if (this.turnReject) {
      this.finishTurn(undefined, error);
    }
    this.activeTurn = false;
    this.setTurnQueued(false);
  }

  private armPing(): void {
    this.clearPing();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, PING_INTERVAL_MS);
  }

  private clearPing(): void {
    if (this.pingTimer !== undefined) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== undefined) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private clearTimers(): void {
    this.clearPing();
    this.clearReconnectTimer();
  }

  private setConnectionState(state: ChatConnectionState): void {
    if (this.connectionState === state) return;
    this.connectionState = state;
    this.callbacks.onConnectionStateChange?.(state);
  }

  private setAgentBusy(busy: boolean): void {
    if (this.agentBusy === busy) return;
    this.agentBusy = busy;
    this.callbacks.onAgentBusyChange?.(busy);
  }

  private setTurnQueued(queued: boolean): void {
    if (this.turnQueued === queued) return;
    this.turnQueued = queued;
    this.callbacks.onQueuedChange?.(queued);
  }
}
