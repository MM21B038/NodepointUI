import type { ChatBlock } from "@/lib/chatTypes";
import {
  applyStreamEvent,
  finalizeAssistantBlocks,
} from "@/lib/chatStreamReducer";
import type { ChatStreamCallbacks, ChatStreamEvent } from "@/database/chatStorage";
import { chatWebSocketUrl } from "@/database/chatStorage";
import { pickRicherBlocks } from "@/lib/chatStreamReducer";
import { rafThrottle, type RafThrottled } from "@/lib/rafThrottle";

export type ChatConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

export interface ChatReadyEvent {
  type: "chat.ready";
  workspace?: string;
  group?: string;
  workspaces?: string[];
  agent_busy?: boolean;
  conversation_id?: string;
  active_branch_id?: string;
}

export interface ChatReconnectedEvent {
  type: "chat.reconnected";
  agent_busy: boolean;
  turn_id?: string;
  hint?: string;
}

export interface ChatWebSocketCallbacks extends ChatStreamCallbacks {
  onConnectionStateChange?: (state: ChatConnectionState) => void;
  onAgentBusyChange?: (busy: boolean) => void;
  onReconnecting?: (attempt: number) => void;
  onReconnected?: (event: ChatReconnectedEvent) => void;
  onInterrupted?: () => void;
  onTurnStarted?: (turnId?: string) => void;
  onCompressStarted?: (message?: string) => void;
  onCompressCompleted?: (message?: string, summaryChars?: number) => void;
  onCompressFailed?: (message?: string) => void;
}

export interface SendChatTurnResult {
  answer: string;
  thinking: string;
  blocks: ChatBlock[];
}

const PING_INTERVAL_MS = 25_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 20_000;
const MAX_RECONNECT_ATTEMPTS = 12;
const TURN_TIMEOUT_MS = 300_000;

function dispatchStreamEvent(
  data: ChatStreamEvent,
  callbacks: ChatWebSocketCallbacks,
  applyBlock: (data: ChatStreamEvent) => void
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
    case "chat.turn_started":
      callbacks.onTurnStarted?.(
        "turn_id" in data ? String(data.turn_id) : undefined
      );
      break;
    case "chat.done":
      callbacks.onDone?.();
      return "done";
    case "chat.cancelled":
      callbacks.onCancelled?.();
      return "cancelled";
    case "chat.interrupted":
      callbacks.onInterrupted?.();
      return "interrupted";
    case "error":
      callbacks.onError?.(
        "message" in data ? String(data.message) : "Unknown error"
      );
      return "error";
    default:
      applyBlock(data);
      break;
  }
}

export class ChatWebSocketClient {
  private ws: WebSocket | null = null;
  private readonly callbacks: ChatWebSocketCallbacks;
  private readonly chatKey: string;

  private connectionState: ChatConnectionState = "disconnected";
  private agentBusy = false;
  private intentionalClose = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private turnTimeout: ReturnType<typeof setTimeout> | undefined;

  private readyReceived = false;
  private pendingReconnectHandshake = false;
  private activeTurn = false;

  private blocks: ChatBlock[] = [];
  private thinking = "";
  private answer = "";

  private turnResolve: ((v: SendChatTurnResult) => void) | null = null;
  private turnReject: ((e: Error) => void) | null = null;
  private readonly emitBlocksThrottled: RafThrottled<() => void>;

  constructor(chatKey: string, callbacks: ChatWebSocketCallbacks = {}) {
    this.chatKey = chatKey;
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

  getBlocks(): ChatBlock[] {
    return this.blocks;
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
          this.armTurnTimeout();
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

    this.setConnectionState(
      this.reconnectAttempts > 0 ? "reconnecting" : "connecting"
    );

    const ws = new WebSocket(chatWebSocketUrl(this.chatKey));
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

      if (wasStreaming) {
        this.scheduleReconnect(
          event.reason?.trim() ||
            (event.code ? `code ${event.code}` : "connection lost")
        );
        return;
      }

      this.setConnectionState("disconnected");
      this.finishTurn(
        undefined,
        new Error(
          event.reason?.trim() ||
            `WebSocket closed (${event.code || "unknown"})`
        )
      );
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
      const busy = Boolean(
        "agent_busy" in data && (data as { agent_busy?: boolean }).agent_busy
      );
      this.setAgentBusy(busy);
      if (!busy && !this.activeTurn) {
        this.setConnectionState("connected");
      }
      return;
    }

    const outcome = dispatchStreamEvent(data, this.callbacks, (evt) =>
      this.applyEventToBlocks(evt)
    );

    if (outcome === "done" || outcome === "cancelled" || outcome === "interrupted") {
      this.blocks = finalizeAssistantBlocks(this.blocks);
      this.emitBlocks();
      this.setAgentBusy(false);
      this.finishTurn({
        answer: this.answer,
        thinking: this.thinking,
        blocks: this.blocks,
      });
      return;
    }

    if (outcome === "error") {
      this.setAgentBusy(false);
      this.finishTurn(
        undefined,
        new Error(
          "message" in data ? String(data.message) : "Stream error"
        )
      );
    }
  }

  private onChatReady(event: ChatReadyEvent): void {
    this.readyReceived = true;
    this.setConnectionState("connected");
    this.callbacks.onReady?.(event);

    const busy = Boolean(event.agent_busy);
    this.setAgentBusy(busy);

    if (busy) {
      this.activeTurn = true;
      this.armTurnTimeout();
    }

    if (this.pendingReconnectHandshake || this.reconnectAttempts > 0) {
      this.ws?.send(JSON.stringify({ type: "chat.reconnect" }));
      this.pendingReconnectHandshake = false;
    } else if (busy) {
      this.ws?.send(JSON.stringify({ type: "chat.reconnect" }));
    }
  }

  private onChatReconnected(event: ChatReconnectedEvent): void {
    this.reconnectAttempts = 0;
    this.setConnectionState("connected");
    this.setAgentBusy(Boolean(event.agent_busy));
    this.callbacks.onReconnected?.(event);

    if (event.agent_busy) {
      this.activeTurn = true;
      this.armTurnTimeout();
      this.ws?.send(JSON.stringify({ type: "chat.status" }));
      this.flushBlockEmit();
    } else {
      this.activeTurn = false;
      this.clearTurnTimeout();
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
        if (Date.now() - started > 15_000) {
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
    error?: Error
  ): void {
    this.activeTurn = false;
    this.clearTurnTimeout();

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
  }

  private armTurnTimeout(): void {
    this.clearTurnTimeout();
    this.turnTimeout = setTimeout(() => {
      this.finishTurn(undefined, new Error("Chat request timed out"));
      this.destroy();
    }, TURN_TIMEOUT_MS);
  }

  private clearTurnTimeout(): void {
    if (this.turnTimeout !== undefined) {
      clearTimeout(this.turnTimeout);
      this.turnTimeout = undefined;
    }
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
    this.clearTurnTimeout();
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
}
