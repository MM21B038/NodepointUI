"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ArrowDown,
  Bot,
  Loader2,
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
import type { ChatBlock, ChatTurn } from "@/lib/chatTypes";
import {
  createEmptyAssistantTurn,
  mergeHistoryWithStreamedAssistantTurn,
  mergeReconnectChatTurns,
  pickRicherBlocks,
} from "@/lib/chatStreamReducer";
import { ChatComposerBar } from "@/components/chat/ChatComposerBar";
import { ChatTurnRow } from "@/components/chat/ChatTurnRow";
import { brand } from "@/lib/brandColors";
import { cn } from "@/lib/utils";
import { CitationTag } from "@/components/chat/CitationTag";
import { createBlockId } from "@/lib/chatTypes";
import { throttle } from "@/lib/rafThrottle";
import { toast } from "sonner";
import { CitationModalProvider } from "@/components/chat/CitationModalContext";
import { CitationChatAlign } from "@/components/chat/CitationChatAlign";
import { CitationSplitLayout } from "@/components/chat/CitationSplitLayout";
import { GroupTagBadge } from "@/components/group/GroupTagBadge";
import { formatGroupMemberCount, formatGroupTag } from "@/lib/groupTag";
import { metaDescription } from "@/lib/resourceMeta";

const TEXTAREA_MAX_HEIGHT = 160;
/** Message thread max width */
const CHAT_THREAD_MAX_CLASS = "max-w-6xl";
/** Composer bar max width (narrower than message thread) */
const CHAT_COMPOSER_MAX_CLASS = "max-w-2xl";
/** Max turns mounted in the DOM; older messages load on demand. */
const INITIAL_VISIBLE_TURNS = 60;
const LOAD_OLDER_TURNS_STEP = 40;

const StreamPage: React.FC = () => {
  const { currentWorkspace, scopeMode, activeGroup, groups } = useWorkspace();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [resolvedWorkspace, setResolvedWorkspace] = useState<string | null>(null);
  const [workspaceKey, setWorkspaceKey] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [agentBusy, setAgentBusy] = useState(false);
  const [connectionState, setConnectionState] =
    useState<ChatConnectionState>("disconnected");
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [isStopping, setIsStopping] = useState(false);
  const [currentInput, setCurrentInput] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const chatClientRef = useRef<ChatWebSocketClient | null>(null);
  const chatLoadRequestIdRef = useRef(0);
  const turnsRef = useRef(turns);
  const syncGenRef = useRef(0);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingLiveBlocksRef = useRef<ChatBlock[] | undefined>(undefined);
  const showReconnectToastRef = useRef(false);
  const [visibleFromIndex, setVisibleFromIndex] = useState(0);
  const scrollOnStreamRef = useRef<ReturnType<typeof throttle<() => void>> | null>(
    null
  );

  turnsRef.current = turns;

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
  const suppressScrollAwayRef = useRef(false);
  const prevTurnsLengthRef = useRef(0);
  const prevLoadingHistoryRef = useRef(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const scrollMessagesToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = messagesRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior });
      return;
    }
    scrollEndRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  const updateScrollAffordances = useCallback(() => {
    if (suppressScrollAwayRef.current) return;
    const el = messagesRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const awayFromBottom = distanceFromBottom > SCROLL_NEAR_BOTTOM_PX;
    userScrolledAwayRef.current = awayFromBottom;
    setShowScrollToBottom(awayFromBottom);
  }, []);

  const scrollToBottomAfterLayout = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (behavior === "smooth") {
            suppressScrollAwayRef.current = true;
            window.setTimeout(() => {
              suppressScrollAwayRef.current = false;
              updateScrollAffordances();
            }, 500);
          }
          scrollMessagesToBottom(behavior);
        });
      });
    },
    [scrollMessagesToBottom, updateScrollAffordances]
  );

  const handleScrollToBottom = useCallback(() => {
    userScrolledAwayRef.current = false;
    setShowScrollToBottom(false);
    scrollToBottomAfterLayout("smooth");
  }, [scrollToBottomAfterLayout]);

  useEffect(() => {
    scrollOnStreamRef.current = throttle(() => {
      if (userScrolledAwayRef.current) return;
      scrollMessagesToBottom("auto");
    }, 120);
    return () => scrollOnStreamRef.current?.cancel();
  }, [scrollMessagesToBottom]);

  const onMessagesScroll = useCallback(() => {
    updateScrollAffordances();
  }, [updateScrollAffordances]);

  useEffect(() => {
    const container = messagesRef.current;
    const content = container?.firstElementChild;
    if (!container || !content) return;

    const ro = new ResizeObserver(() => {
      if (userScrolledAwayRef.current || suppressScrollAwayRef.current) return;
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      if (distanceFromBottom > 4) {
        scrollMessagesToBottom("auto");
      }
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, [scrollMessagesToBottom, workspaceKey, turns.length]);

  useEffect(() => {
    const prevLen = prevTurnsLengthRef.current;
    prevTurnsLengthRef.current = turns.length;
    if (turns.length > prevLen && !userScrolledAwayRef.current) {
      scrollToBottomAfterLayout("smooth");
    }
  }, [turns.length, scrollToBottomAfterLayout]);

  useEffect(() => {
    if (isLoadingHistory) {
      prevLoadingHistoryRef.current = true;
      return;
    }
    if (!prevLoadingHistoryRef.current) return;
    prevLoadingHistoryRef.current = false;
    if (turns.length === 0) return;
    userScrolledAwayRef.current = false;
    setShowScrollToBottom(false);
    scrollToBottomAfterLayout("smooth");
  }, [isLoadingHistory, turns.length, scrollToBottomAfterLayout]);

  useEffect(() => {
    const next = Math.max(0, turns.length - INITIAL_VISIBLE_TURNS);
    setVisibleFromIndex((prev) => (streamActive ? next : Math.min(prev, next)));
  }, [turns.length, workspaceKey, streamActive]);

  const visibleTurns = useMemo(
    () => turns.slice(visibleFromIndex),
    [turns, visibleFromIndex]
  );
  const hiddenTurnCount = visibleFromIndex;

  const showOlderMessages = useCallback(() => {
    setVisibleFromIndex((prev) =>
      Math.max(0, prev - LOAD_OLDER_TURNS_STEP)
    );
  }, []);

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
        setVisibleFromIndex(Math.max(0, history.length - INITIAL_VISIBLE_TURNS));
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
        next[next.length - 1] = { ...last, blocks };
        return next;
      }
      if (last?.role === "assistant") {
        next[next.length - 1] = {
          ...last,
          isStreaming: true,
          blocks,
        };
        return next;
      }
      next.push({ ...createEmptyAssistantTurn(), blocks });
      return next;
    });
    scrollOnStreamRef.current?.();
  }, []);

  const syncChatFromServer = useCallback(
    async (liveBlocks?: ChatBlock[], options?: { fullReplace?: boolean }) => {
      const gen = ++syncGenRef.current;
      try {
        const { turns: history, workspace } = await loadChatTurns(
          scopeMode,
          currentWorkspace,
          activeGroup
        );
        if (gen !== syncGenRef.current) return;

        setResolvedWorkspace(workspace);
        const client = chatClientRef.current;
        const busy = client?.isAgentBusy() ?? false;
        const blocks =
          liveBlocks ??
          pendingLiveBlocksRef.current ??
          client?.getBlocks() ??
          [];

        setTurns((prev) => {
          if (options?.fullReplace) {
            const streamed = prev[prev.length - 1];
            let next = mergeHistoryWithStreamedAssistantTurn(
              history,
              streamed?.role === "assistant" ? streamed : undefined
            );
            const last = next[next.length - 1];
            if (last?.role === "assistant" && last.isStreaming) {
              next = [
                ...next.slice(0, -1),
                { ...last, isStreaming: false },
              ];
            }
            return next;
          }
          if (!busy && blocks.length === 0) return history;
          return mergeReconnectChatTurns(history, prev, blocks);
        });

        if (blocks.length) {
          client?.hydrateBlocks(blocks);
        }
      } catch (error) {
        if (gen !== syncGenRef.current) return;
        console.error("Failed to sync chat after reconnect:", error);
      }
    },
    [scopeMode, currentWorkspace, activeGroup]
  );

  const scheduleReconnectSync = useCallback(
    (liveBlocks?: ChatBlock[]) => {
      if (liveBlocks?.length) {
        pendingLiveBlocksRef.current = liveBlocks;
      }
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        syncTimerRef.current = undefined;
        const pending = pendingLiveBlocksRef.current;
        pendingLiveBlocksRef.current = undefined;
        void syncChatFromServer(pending);
      }, 280);
    },
    [syncChatFromServer]
  );

  const getUiAssistantBlocks = useCallback((): ChatBlock[] => {
    const list = turnsRef.current;
    const last = list[list.length - 1];
    if (last?.role === "assistant") return last.blocks;
    if (
      list.length >= 2 &&
      list[list.length - 2]?.role === "assistant"
    ) {
      return list[list.length - 2]!.blocks;
    }
    return [];
  }, []);

  const attachLiveTurn = useCallback((client: ChatWebSocketClient) => {
    setIsStreaming(true);
    setAgentBusy(true);
    const uiBlocks = getUiAssistantBlocks();
    client.hydrateBlocks(pickRicherBlocks(uiBlocks, client.getBlocks()));
    client.flushBlockEmit();
    scheduleReconnectSync(client.getBlocks());
  }, [getUiAssistantBlocks, scheduleReconnectSync]);

  const detachLiveTurn = useCallback(() => {
    setIsStreaming(false);
    setAgentBusy(false);
    toast.dismiss("chat-reconnect");
    void syncChatFromServer(undefined, { fullReplace: true });
  }, [syncChatFromServer]);

  const streamHandlersRef = useRef({
    attachLiveTurn,
    detachLiveTurn,
    applyStreamBlocks,
    scheduleReconnectSync,
    syncChatFromServer,
    getUiAssistantBlocks,
    setResolvedWorkspace,
    setIsStreaming,
    setAgentBusy,
    setConnectionState,
    setReconnectAttempt,
  });
  streamHandlersRef.current = {
    applyStreamBlocks,
    scheduleReconnectSync,
    syncChatFromServer,
    getUiAssistantBlocks,
    attachLiveTurn,
    detachLiveTurn,
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
      },
      onLiveAttach: () => {
        streamHandlersRef.current.attachLiveTurn(client);
      },
      onReconnected: (event) => {
        const hadReconnect = showReconnectToastRef.current;
        showReconnectToastRef.current = false;
        if (event.agent_busy) {
          if (hadReconnect) {
            toast.success("Reconnected — resuming live stream", {
              id: "chat-reconnect",
            });
          }
        } else {
          streamHandlersRef.current.detachLiveTurn();
        }
      },
      onReconnecting: (attempt) => {
        showReconnectToastRef.current = true;
        streamHandlersRef.current.setReconnectAttempt(attempt);
        toast.loading(`Reconnecting (${attempt})…`, { id: "chat-reconnect" });
      },
      onConnectionStateChange: (state) => {
        streamHandlersRef.current.setConnectionState(state);
      },
      onAgentBusyChange: (busy) => {
        streamHandlersRef.current.setAgentBusy(busy);
      },
      onDone: () => {
        setIsStopping(false);
        streamHandlersRef.current.setIsStreaming(false);
        streamHandlersRef.current.setAgentBusy(false);
        toast.dismiss("chat-reconnect");
        toast.dismiss("chat-stop");
        void streamHandlersRef.current.syncChatFromServer(undefined, {
          fullReplace: true,
        });
      },
      onCancelled: () => {
        setIsStopping(false);
        streamHandlersRef.current.setIsStreaming(false);
        streamHandlersRef.current.setAgentBusy(false);
        toast.dismiss("chat-reconnect");
        toast.dismiss("chat-stop");
        setTurns((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = { ...last, isStreaming: false };
          }
          return next;
        });
        void streamHandlersRef.current.syncChatFromServer(undefined, {
          fullReplace: true,
        });
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
        setIsStopping(false);
        streamHandlersRef.current.setIsStreaming(false);
        streamHandlersRef.current.setAgentBusy(false);
        toast.dismiss("chat-reconnect");
        toast.warning("Stream interrupted — partial reply saved");
        void streamHandlersRef.current.syncChatFromServer(undefined, {
          fullReplace: true,
        });
      },
      onError: (message) => {
        setIsStopping(false);
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
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncGenRef.current += 1;
      client.destroy();
      chatClientRef.current = null;
      setConnectionState("disconnected");
      setAgentBusy(false);
      setReconnectAttempt(0);
      showReconnectToastRef.current = false;
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
    setVisibleFromIndex(0);
    setWorkspaceKey(null);
    setResolvedWorkspace(null);
    userScrolledAwayRef.current = false;
    setShowScrollToBottom(false);
    prevLoadingHistoryRef.current = true;
    void loadChat(requestId);
  }, [scopeMode, currentWorkspace, activeGroup, loadChat]);

  useEffect(() => {
    return () => {
      cancelRef.current?.();
      cancelRef.current = null;
      scrollOnStreamRef.current?.cancel();
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
    userScrolledAwayRef.current = false;
    setShowScrollToBottom(false);
    setTurns((prev) => [...prev, userTurn, assistantTurn]);
    setVisibleFromIndex((prev) =>
      Math.max(0, turns.length + 2 - INITIAL_VISIBLE_TURNS, prev)
    );
    setCurrentInput("");
    setIsStreaming(true);
    setAgentBusy(true);
    setIsStopping(false);

    try {
      cancelRef.current = () => client.requestCancel();
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
      const message =
        error instanceof Error ? error.message : "An unknown error occurred during chat.";
      if (message === "Chat cancelled") return;
      console.error("Chat stream failed:", error);
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
      const stillBusy = chatClientRef.current?.isAgentBusy() ?? false;
      if (!stillBusy) {
        setIsStreaming(false);
        setAgentBusy(false);
        setIsStopping(false);
      }
      cancelRef.current = null;
    }
  }, [
    currentInput,
    canSend,
    workspaceKey,
    scopeMode,
    currentWorkspace,
    activeGroup,
    turns.length,
  ]);

  const handleStop = useCallback(() => {
    const client = chatClientRef.current;
    if (!client || !streamActive || isStopping) return;
    setIsStopping(true);
    client.requestCancel();
  }, [streamActive, isStopping]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !streamActive) {
      e.preventDefault();
      handleSend();
    }
  };

  const activeGroupMeta = useMemo(
    () => groups.find((g) => g.name === activeGroup) ?? null,
    [groups, activeGroup]
  );
  const activeGroupTypeLabel = activeGroupMeta
    ? formatGroupTag(activeGroupMeta.tag)
    : null;
  const activeGroupMemberLabel = activeGroupMeta
    ? formatGroupMemberCount(activeGroupMeta)
    : null;
  const activeGroupDescription = activeGroupMeta
    ? metaDescription(activeGroupMeta)
    : null;

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
                className="max-w-[min(100%,18rem)] truncate border border-border/60 font-normal"
              >
                {scopeMode === "group" ? (
                  <>
                    <Users className="mr-1 inline h-3 w-3 shrink-0" />
                    {activeGroup ?? "No group"}
                    {activeGroupMeta ? (
                      <>
                        <span className="text-muted-foreground"> · </span>
                        <GroupTagBadge
                          tag={activeGroupMeta.tag}
                          size="xs"
                          className="align-middle normal-case"
                        />
                      </>
                    ) : null}
                    {activeGroupMemberLabel ? (
                      <span className="text-muted-foreground"> · {activeGroupMemberLabel}</span>
                    ) : null}
                    {activeGroupDescription ? (
                      <span className="hidden text-muted-foreground sm:inline">
                        {" "}
                        — {activeGroupDescription}
                      </span>
                    ) : null}
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
          <Alert className={cn(brand.warning.border, brand.warning.bg, "border py-2")}>
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

        <div className="relative min-h-0 flex-1">
        <div
          ref={messagesRef}
          onScroll={onMessagesScroll}
          className="h-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-4"
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

          {hiddenTurnCount > 0 && (
            <div className="flex justify-center py-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={showOlderMessages}
              >
                Load older messages ({hiddenTurnCount} hidden)
              </Button>
            </div>
          )}

          {visibleTurns.map((turn, index) => {
            const globalIndex = visibleFromIndex + index;
            const assistantStreaming =
              Boolean(turn.isStreaming) ||
              (streamActive &&
                turn.role === "assistant" &&
                globalIndex === turns.length - 1);

            return (
              <ChatTurnRow
                key={turn.id}
                turn={turn}
                isStreaming={assistantStreaming}
              />
            );
          })}

          <div ref={scrollEndRef} className="h-px" />
          </CitationChatAlign>
        </div>

        {showScrollToBottom && emptyState === "ready" ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="pointer-events-auto h-9 w-9 rounded-full border border-border/60 bg-background/95 shadow-md backdrop-blur-sm hover:bg-background"
              onClick={handleScrollToBottom}
              aria-label="Scroll to latest messages"
              title="Jump to latest"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
        </div>

      <footer className="z-10 shrink-0  border-border/40 bg-background px-4 pb-3 pt-2">
        <CitationChatAlign maxWidthClass={CHAT_COMPOSER_MAX_CLASS}>
          <ChatComposerBar
            value={currentInput}
            onChange={setCurrentInput}
            onKeyDown={handleKeyDown}
            onSend={handleSend}
            onStop={handleStop}
            placeholder={
              scopeMode === "group"
                ? `Message group ${activeGroup ?? ""}…`
                : `Message ${displayTarget}…`
            }
            textareaRef={textareaRef}
            disabled={!isInputEnabled || !workspaceKey}
            canSend={canSend}
            isStreaming={streamActive}
            isStopping={isStopping}
          />
          <p className="text-[10px] text-center text-muted-foreground mt-2 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
            <span>
              {scopeMode === "group"
                ? `Group chat · ${activeGroupTypeLabel ?? "group"} scope (${activeGroupMemberLabel ?? "members"})`
                : `Workspace ${displayTarget} chat`}
            </span>
            {connectionState !== "connected" && connectionState !== "reconnecting" && (
              <span className={brand.warning.text}>
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
