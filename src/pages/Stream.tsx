"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Bot,
  Loader2,
  Send,
  Trash2,
  RefreshCw,
  FolderOpen,
  Users,
} from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import GroupScopeSelector from "@/components/scope/GroupScopeSelector";
import { loadChatTurns, clearChat } from "@/database/chatStorage";
import {
  ChatWebSocketClient,
  type ChatConnectionState,
} from "@/lib/chatWebSocket";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ChatBlock, ChatTurn } from "@/lib/chatTypes";
import {
  createEmptyAssistantTurn,
  markLastAssistantStreaming,
  mergeHistoryWithStreamedAssistantTurn,
} from "@/lib/chatStreamReducer";
import { AssistantActivityView } from "@/components/chat/AssistantActivityView";
import { CitationTag } from "@/components/chat/CitationTag";
import { CopyButton } from "@/components/chat/CopyButton";
import { getAssistantResponseText } from "@/lib/chatCopyText";
import { createBlockId } from "@/lib/chatTypes";
import { toast } from "sonner";
import { CitationModalProvider } from "@/components/chat/CitationModalContext";
import { CitationChatAlign } from "@/components/chat/CitationChatAlign";
import { CitationSplitLayout } from "@/components/chat/CitationSplitLayout";

const TEXTAREA_MAX_HEIGHT = 160;
/** Message thread max width */
const CHAT_THREAD_MAX_CLASS = "max-w-6xl";
/** Composer bar max width (narrower than message thread) */
const CHAT_COMPOSER_MAX_CLASS = "max-w-2xl";

const StreamPage: React.FC = () => {
  const { currentWorkspace, scopeMode, activeGroup } = useWorkspace();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [resolvedWorkspace, setResolvedWorkspace] = useState<string | null>(null);
  const [workspaceKey, setWorkspaceKey] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [agentBusy, setAgentBusy] = useState(false);
  const [connectionState, setConnectionState] =
    useState<ChatConnectionState>("disconnected");
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [currentInput, setCurrentInput] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const chatClientRef = useRef<ChatWebSocketClient | null>(null);
  const chatLoadRequestIdRef = useRef(0);

  const streamActive = isStreaming || agentBusy;
  const isConnected =
    connectionState === "connected" || connectionState === "reconnecting";

  const isInputEnabled =
    !streamActive &&
    !isLoadingHistory &&
    isConnected &&
    (scopeMode === "group"
      ? !!activeGroup?.trim()
      : !!currentWorkspace?.trim());
  const canSend =
    isInputEnabled &&
    !agentBusy &&
    currentInput.trim().length > 0 &&
    !!workspaceKey;

  const SCROLL_NEAR_BOTTOM_PX = 96;
  const userScrolledAwayRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const prevTurnsLengthRef = useRef(0);

  const scrollMessagesToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = messagesRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior });
      lastScrollTopRef.current = el.scrollTop;
      return;
    }
    scrollEndRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  const onMessagesScroll = useCallback(() => {
    const el = messagesRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    if (scrollTop < lastScrollTopRef.current - 2) {
      userScrolledAwayRef.current = distanceFromBottom > SCROLL_NEAR_BOTTOM_PX;
    } else if (distanceFromBottom <= SCROLL_NEAR_BOTTOM_PX) {
      userScrolledAwayRef.current = false;
    }

    lastScrollTopRef.current = scrollTop;
  }, []);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.addEventListener("scroll", onMessagesScroll, { passive: true });
    return () => el.removeEventListener("scroll", onMessagesScroll);
  }, [onMessagesScroll]);

  useEffect(() => {
    const prevLen = prevTurnsLengthRef.current;
    prevTurnsLengthRef.current = turns.length;
    if (turns.length > prevLen) {
      userScrolledAwayRef.current = false;
      scrollMessagesToBottom("smooth");
    }
  }, [turns.length, scrollMessagesToBottom]);

  useEffect(() => {
    if (userScrolledAwayRef.current) return;
    scrollMessagesToBottom("auto");
  }, [turns, streamActive, scrollMessagesToBottom]);

  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [currentInput, adjustTextareaHeight]);

  const loadChat = useCallback(
    async (requestId: number) => {
      try {
        const { chatKey, workspace, turns: history } = await loadChatTurns(
          scopeMode,
          currentWorkspace,
          activeGroup
        );
        if (requestId !== chatLoadRequestIdRef.current) return;
        setWorkspaceKey(chatKey);
        setResolvedWorkspace(workspace);
        setTurns(history);
        setLoadError(null);
      } catch (error) {
        if (requestId !== chatLoadRequestIdRef.current) return;
        console.error("Failed to load chat:", error);
        setWorkspaceKey(null);
        setResolvedWorkspace(null);
        setTurns([]);
        setLoadError(
          error instanceof Error ? error.message : "Failed to load chat history"
        );
      } finally {
        if (requestId === chatLoadRequestIdRef.current) {
          setIsLoadingHistory(false);
        }
      }
    },
    [scopeMode, currentWorkspace, activeGroup]
  );

  const applyStreamBlocks = useCallback((blocks: ChatBlock[]) => {
    setTurns((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last?.role === "assistant" && last.isStreaming) {
        next[next.length - 1] = { ...last, blocks: [...blocks] };
        return next;
      }
      if (last?.role === "assistant") {
        next[next.length - 1] = {
          ...last,
          isStreaming: true,
          blocks: [...blocks],
        };
        return next;
      }
      next.push({ ...createEmptyAssistantTurn(), blocks: [...blocks] });
      return next;
    });
  }, []);

  const syncChatFromServer = useCallback(
    async (liveBlocks?: ChatBlock[]) => {
      try {
        const { turns: history, workspace } = await loadChatTurns(
          scopeMode,
          currentWorkspace,
          activeGroup
        );
        setResolvedWorkspace(workspace);
        setTurns((prev) => {
          const streamedAssistant =
            liveBlocks?.length
              ? ({
                  ...createEmptyAssistantTurn(),
                  blocks: liveBlocks,
                  isStreaming: true,
                } satisfies ChatTurn)
              : prev[prev.length - 1]?.role === "assistant"
                ? prev[prev.length - 1]
                : undefined;

          let next = mergeHistoryWithStreamedAssistantTurn(
            history,
            streamedAssistant?.role === "assistant" ? streamedAssistant : undefined
          );

          const attachLive =
            chatClientRef.current?.isAgentBusy() ||
            Boolean(liveBlocks?.length) ||
            Boolean(streamedAssistant?.isStreaming);

          if (attachLive) {
            next = markLastAssistantStreaming(next, liveBlocks);
          }
          return next;
        });
      } catch (error) {
        console.error("Failed to sync chat after reconnect:", error);
      }
    },
    [scopeMode, currentWorkspace, activeGroup]
  );

  const streamHandlersRef = useRef({
    applyStreamBlocks,
    syncChatFromServer,
    setResolvedWorkspace,
    setIsStreaming,
    setAgentBusy,
    setConnectionState,
    setReconnectAttempt,
  });
  streamHandlersRef.current = {
    applyStreamBlocks,
    syncChatFromServer,
    setResolvedWorkspace,
    setIsStreaming,
    setAgentBusy,
    setConnectionState,
    setReconnectAttempt,
  };

  useEffect(() => {
    if (!workspaceKey || isLoadingHistory) return;

    const client = new ChatWebSocketClient(workspaceKey, {
      onReady: (ready) => {
        if (ready.workspace) {
          streamHandlersRef.current.setResolvedWorkspace(ready.workspace);
        }
        if (ready.agent_busy) {
          streamHandlersRef.current.setIsStreaming(true);
          void streamHandlersRef.current.syncChatFromServer(
            client.getBlocks()
          );
        }
      },
      onReconnected: () => {
        toast.info("Reconnected — resuming live stream", { id: "chat-reconnect" });
        streamHandlersRef.current.setIsStreaming(true);
        void streamHandlersRef.current.syncChatFromServer(client.getBlocks());
      },
      onReconnecting: (attempt) => {
        streamHandlersRef.current.setReconnectAttempt(attempt);
        toast.loading(`Reconnecting (${attempt})…`, { id: "chat-reconnect" });
      },
      onConnectionStateChange: (state) => {
        streamHandlersRef.current.setConnectionState(state);
        if (state === "connected") {
          streamHandlersRef.current.setReconnectAttempt(0);
          toast.dismiss("chat-reconnect");
        }
      },
      onAgentBusyChange: (busy) => {
        streamHandlersRef.current.setAgentBusy(busy);
        streamHandlersRef.current.setIsStreaming(busy);
      },
      onDone: () => {
        streamHandlersRef.current.setIsStreaming(false);
        streamHandlersRef.current.setAgentBusy(false);
        void streamHandlersRef.current.syncChatFromServer();
      },
      onCancelled: () => {
        streamHandlersRef.current.setIsStreaming(false);
        streamHandlersRef.current.setAgentBusy(false);
        void streamHandlersRef.current.syncChatFromServer();
      },
      onBlocksChange: (blocks) => {
        streamHandlersRef.current.applyStreamBlocks(blocks);
      },
      onCompressed: () => {
        toast.info("Context compressed", {
          description:
            "Older context was summarized server-side. History shown is unchanged.",
        });
      },
      onCompressStarted: (message) => {
        toast.info(message ?? "Compressing context…", { id: "chat-compress" });
      },
      onCompressCompleted: (message) => {
        toast.success(message ?? "Context compressed", { id: "chat-compress" });
      },
      onCompressFailed: (message) => {
        toast.warning(message ?? "Context compression failed", {
          id: "chat-compress",
        });
      },
      onInterrupted: () => {
        streamHandlersRef.current.setIsStreaming(false);
        streamHandlersRef.current.setAgentBusy(false);
        toast.warning("Stream interrupted — partial reply saved");
        void streamHandlersRef.current.syncChatFromServer();
      },
      onError: (message) => {
        streamHandlersRef.current.setIsStreaming(false);
        streamHandlersRef.current.setAgentBusy(false);
        toast.error(message, { id: "chat-reconnect" });
        setTurns((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = {
              ...last,
              isStreaming: false,
              blocks: [
                ...last.blocks,
                { id: createBlockId("err"), kind: "error", message },
              ],
            };
          }
          return next;
        });
      },
    });

    client.connect();
    chatClientRef.current = client;

    return () => {
      client.destroy();
      chatClientRef.current = null;
      setConnectionState("disconnected");
      setAgentBusy(false);
      setReconnectAttempt(0);
    };
  }, [workspaceKey, isLoadingHistory]);

  useEffect(() => {
    if (scopeMode === "workspace" && !currentWorkspace?.trim()) {
      chatLoadRequestIdRef.current += 1;
      setIsLoadingHistory(false);
      setLoadError(null);
      setTurns([]);
      setWorkspaceKey(null);
      setResolvedWorkspace(null);
      return;
    }
    if (scopeMode === "group" && !activeGroup?.trim()) {
      chatLoadRequestIdRef.current += 1;
      setIsLoadingHistory(false);
      setLoadError(null);
      setTurns([]);
      setWorkspaceKey(null);
      setResolvedWorkspace(null);
      return;
    }
    cancelRef.current?.();
    cancelRef.current = null;
    chatClientRef.current?.destroy();
    chatClientRef.current = null;
    setConnectionState("disconnected");
    setAgentBusy(false);
    setIsStreaming(false);
    const requestId = ++chatLoadRequestIdRef.current;
    setIsLoadingHistory(true);
    setLoadError(null);
    setTurns([]);
    setWorkspaceKey(null);
    setResolvedWorkspace(null);
    void loadChat(requestId);
  }, [scopeMode, currentWorkspace, activeGroup, loadChat]);

  useEffect(() => {
    return () => {
      cancelRef.current?.();
      cancelRef.current = null;
    };
  }, []);

  const handleClearChat = async () => {
    if (streamActive || !workspaceKey) return;
    if (!window.confirm("Clear all messages in this chat? This cannot be undone.")) return;
    try {
      await clearChat(scopeMode, currentWorkspace, activeGroup);
      toast.success("Chat cleared");
      const requestId = ++chatLoadRequestIdRef.current;
      setIsLoadingHistory(true);
      await loadChat(requestId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clear chat");
    }
  };

  const handleSend = useCallback(async () => {
    const query = currentInput.trim();
    if (!query || !canSend || !workspaceKey) return;

    const client = chatClientRef.current;
    if (!client) {
      toast.error("Chat is not connected yet. Wait a moment and try again.");
      return;
    }

    const userTurn: ChatTurn = {
      id: createBlockId("user"),
      role: "user",
      content: query,
      blocks: [],
      timestamp: new Date(),
    };

    const assistantTurn = createEmptyAssistantTurn();
    setTurns((prev) => [...prev, userTurn, assistantTurn]);
    setCurrentInput("");
    setIsStreaming(true);
    setAgentBusy(true);

    try {
      cancelRef.current = () => client.cancelTurn({ destroy: false });
      await client.sendChat(query);

      const { turns: history, workspace } = await loadChatTurns(
        scopeMode,
        currentWorkspace,
        activeGroup
      );
      setResolvedWorkspace(workspace);
      setTurns((prev) => {
        const streamed = prev[prev.length - 1];
        const merged = mergeHistoryWithStreamedAssistantTurn(
          history,
          streamed?.role === "assistant" ? streamed : undefined
        );
        const last = merged[merged.length - 1];
        if (last?.role === "assistant" && last.isStreaming) {
          return [
            ...merged.slice(0, -1),
            { ...last, isStreaming: false },
          ];
        }
        return merged;
      });
    } catch (error) {
      console.error("Chat stream failed:", error);
      const message =
        error instanceof Error ? error.message : "An unknown error occurred during chat.";
      setTurns((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant") {
          next[next.length - 1] = {
            ...last,
            isStreaming: false,
            blocks: [
              ...last.blocks,
              { id: createBlockId("err"), kind: "error", message },
            ],
          };
        }
        return next;
      });
    } finally {
      setIsStreaming(false);
      setAgentBusy(false);
      cancelRef.current = null;
    }
  }, [currentInput, canSend, workspaceKey, scopeMode, currentWorkspace, activeGroup]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const emptyState = useMemo(() => {
    if (scopeMode === "workspace" && !currentWorkspace?.trim()) return "no-workspace";
    if (scopeMode === "group" && !activeGroup?.trim()) return "no-group";
    if (isLoadingHistory) return "loading";
    if (loadError) return "error";
    if (turns.length === 0) return "empty";
    return "ready";
  }, [scopeMode, currentWorkspace, activeGroup, isLoadingHistory, loadError, turns.length]);

  const displayTarget =
    resolvedWorkspace ??
    (scopeMode === "group" && activeGroup
      ? `group: ${activeGroup}`
      : currentWorkspace) ??
    "—";

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <CitationSplitLayout className="min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <header className="z-10 shrink-0 bg-background px-4 pb-2 pt-3">
        <CitationChatAlign maxWidthClass={CHAT_THREAD_MAX_CLASS}>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 shadow-sm sm:px-4 sm:py-2.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="shrink-0 text-base font-semibold tracking-tight">Chat</h1>
              <span className="hidden h-4 w-px shrink-0 bg-border sm:block" aria-hidden />
              <Badge
                variant="secondary"
                className="max-w-[min(100%,12rem)] truncate border border-border/60 font-normal"
              >
                {scopeMode === "group" ? (
                  <>
                    <Users className="mr-1 inline h-3 w-3 shrink-0" />
                    {activeGroup ?? "No group"}
                  </>
                ) : (
                  <>
                    <FolderOpen className="mr-1 inline h-3 w-3 shrink-0" />
                    {displayTarget}
                  </>
                )}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <GroupScopeSelector disabled={streamActive} />

              <span className="hidden h-6 w-px shrink-0 bg-border sm:block" aria-hidden />

              <div className="flex items-center gap-1.5">
                {loadError && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      const requestId = ++chatLoadRequestIdRef.current;
                      setIsLoadingHistory(true);
                      void loadChat(requestId);
                    }}
                  >
                    <RefreshCw className="mr-1 h-3.5 w-3.5" />
                    Retry
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={handleClearChat}
                  disabled={streamActive || !workspaceKey}
                  title="Clear chat history"
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Clear
                </Button>
              </div>
            </div>
          </div>
        </CitationChatAlign>
      </header>

      {connectionState === "reconnecting" && (
        <CitationChatAlign maxWidthClass={CHAT_THREAD_MAX_CLASS} className="px-4 pb-2">
          <Alert className="border-amber-500/40 bg-amber-500/10 py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertTitle className="text-sm">Reconnecting</AlertTitle>
            <AlertDescription className="text-xs">
              Connection lost during streaming. The agent is still running
              {reconnectAttempt > 0 ? ` (attempt ${reconnectAttempt})` : ""}…
            </AlertDescription>
          </Alert>
        </CitationChatAlign>
      )}

      {agentBusy && connectionState === "connected" && !isStreaming && (
        <CitationChatAlign maxWidthClass={CHAT_THREAD_MAX_CLASS} className="px-4 pb-2">
          <Alert className="border-primary/30 bg-primary/5 py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertTitle className="text-sm">Agent busy</AlertTitle>
            <AlertDescription className="text-xs">
              A turn is in progress on the server. Live updates are attached — wait before sending.
            </AlertDescription>
          </Alert>
        </CitationChatAlign>
      )}

        <div
          ref={messagesRef}
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4"
        >
          <CitationChatAlign
            maxWidthClass={CHAT_THREAD_MAX_CLASS}
            className="space-y-5 px-3 py-4 sm:px-6"
          >
          {emptyState === "no-workspace" && (
            <Alert>
              <AlertTitle>Select a workspace</AlertTitle>
              <AlertDescription>
                Use the workspace selector in the navbar for per-workspace chat, or switch to{" "}
                <strong>Group</strong> and pick a workspace group.
              </AlertDescription>
            </Alert>
          )}

          {emptyState === "no-group" && (
            <Alert>
              <AlertTitle>Select a group</AlertTitle>
              <AlertDescription>
                Create a workspace group on the Workspaces page, then choose it here for
                group-scoped chat.
              </AlertDescription>
            </Alert>
          )}

          {emptyState === "loading" && (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading chat…</span>
            </div>
          )}

          {emptyState === "error" && (
            <Alert variant="destructive">
              <AlertTitle>Could not load chat</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          )}

          {emptyState === "empty" && (
            <div className="text-center py-20 text-muted-foreground">
              <Bot className="h-14 w-14 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium text-foreground">How can I help?</p>
              <p className="text-sm mt-2 max-w-sm mx-auto">
                Ask about your knowledge graph in{" "}
                <span className="font-medium text-foreground">{displayTarget}</span>.
                Add workspaces to your group to enable knowledge search.
              </p>
            </div>
          )}

          {turns.map((turn, turnIndex) => {
            const userText = turn.content?.trim() ?? "";
            const assistantText = getAssistantResponseText(turn.blocks);
            const copyText = turn.role === "user" ? userText : assistantText;
            const assistantStreaming =
              Boolean(turn.isStreaming) ||
              (streamActive &&
                turn.role === "assistant" &&
                turnIndex === turns.length - 1);

            return (
            <div
              key={turn.id}
              className={cn(
                "group flex",
                turn.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "min-w-0",
                  turn.role === "user"
                    ? "max-w-[min(100%,28rem)] shrink-0"
                    : "w-full flex-1"
                )}
              >
                <div
                  className={cn(
                    "relative w-full rounded-2xl px-4 py-3 shadow-sm",
                    turn.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border/60 font-chat text-[15px] leading-relaxed"
                  )}
                >
                  {turn.role === "user" ? (
                    <p className="text-sm whitespace-pre-wrap leading-relaxed pr-6">
                      {turn.content}
                    </p>
                  ) : (
                    <div className="pr-6">
                      <AssistantActivityView
                        blocks={turn.blocks}
                        isStreaming={assistantStreaming}
                      />
                    </div>
                  )}
                  <CopyButton
                    text={copyText}
                    label={turn.role === "user" ? "Copy message" : "Copy response"}
                    variant={turn.role === "user" ? "ghostOnPrimary" : "ghost"}
                    className={cn(
                      "pointer-events-none absolute right-1.5 top-1.5 z-10 h-7 w-7 opacity-0 shadow-sm transition-opacity",
                      "group-hover:pointer-events-auto group-hover:opacity-100",
                      "group-focus-within:pointer-events-auto group-focus-within:opacity-100",
                      "focus-visible:pointer-events-auto focus-visible:opacity-100"
                    )}
                  />
                </div>
              </div>
            </div>
            );
          })}

          <div ref={scrollEndRef} className="h-px" />
          </CitationChatAlign>
        </div>

      <footer className="z-10 shrink-0  border-border/40 bg-background px-4 pb-3 pt-2">
        <CitationChatAlign maxWidthClass={CHAT_COMPOSER_MAX_CLASS}>
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm">
            <Textarea
              ref={textareaRef}
              placeholder={
                scopeMode === "group"
                  ? `Message group ${activeGroup ?? ""}…`
                  : `Message ${displayTarget}…`
              }
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!isInputEnabled || !workspaceKey}
              rows={1}
              className="min-h-[44px] max-h-40 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <Button
              onClick={handleSend}
              disabled={!canSend}
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl"
              title="Send"
            >
              {streamActive ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-center text-muted-foreground mt-2 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
            <span>
              {scopeMode === "group"
                ? `Group chat · searches workspaces in ${activeGroup ?? "group"}`
                : `Workspace ${displayTarget} chat`}
            </span>
            {connectionState !== "connected" && connectionState !== "reconnecting" && (
              <span className="text-amber-600 dark:text-amber-400">
                · {connectionState === "connecting" ? "Connecting…" : "Offline"}
              </span>
            )}
            {agentBusy && (
              <span className="text-primary">· Agent busy</span>
            )}
            <span className="text-muted-foreground/80">· Citations</span>
            <CitationTag kind="doc" label="" />
            <CitationTag kind="entity" label="" />
            <CitationTag kind="relation" label="" />
            <CitationTag kind="chunk" label="" />
          </p>
        </CitationChatAlign>
      </footer>
        </div>
      </CitationSplitLayout>
    </div>
  );
};

const Stream: React.FC = () => (
  <CitationModalProvider>
    <StreamPage />
  </CitationModalProvider>
);

export default Stream;
