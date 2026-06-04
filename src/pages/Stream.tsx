"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ArrowDown,
  Bot,
  Loader2,
} from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useResolvedScopeOwner } from "@/hooks/useResolvedScopeOwner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChatSessionsSheet } from "@/components/chat/ChatSessionsSheet";
import {
  ChatPageToolbar,
  type ChatBanner,
} from "@/components/chat/ChatPageToolbar";
import {
  clearChatSessionMessages,
  loadChatTurns,
  resolveChatConnectMode,
  type ChatPartialSaved,
} from "@/database/chatStorage";
import { useChatSessions } from "@/hooks/useChatSessions";
import {
  ChatWebSocketClient,
  type ChatConnectionState,
} from "@/lib/chatWebSocket";
import { Button } from "@/components/ui/button";
import {
  applyPartialSavedToTurns,
  createEmptyAssistantTurn,
  mergeHistoryWithStreamedAssistantTurn,
  mergeReconnectChatTurns,
  pickRicherBlocks,
} from "@/lib/chatStreamReducer";
import { ChatComposerBar } from "@/components/chat/ChatComposerBar";
import { chatPageCanvasClass } from "@/components/chat/chatDialogStyles";
import { ChatTurnRow } from "@/components/chat/ChatTurnRow";
import { cn } from "@/lib/utils";
import type { ChatBlock, ChatTurn } from "@/lib/chatTypes";
import { createBlockId } from "@/lib/chatTypes";
import { throttle } from "@/lib/rafThrottle";
import { toast } from "sonner";
import { CitationModalProvider } from "@/components/chat/CitationModalContext";
import { CitationChatAlign } from "@/components/chat/CitationChatAlign";
import { CitationSplitLayout } from "@/components/chat/CitationSplitLayout";
import {
  duplicateNamesInList,
  formatScopedResourceLabel,
  listHasMultipleOwners,
} from "@/lib/ownerScope";

const TEXTAREA_MAX_HEIGHT = 120;
const CHAT_THREAD_MAX_CLASS = "w-full max-w-3xl";
const CHAT_COMPOSER_MAX_CLASS = "w-full max-w-3xl";
/** Max turns mounted in the DOM; older messages load on demand. */
const INITIAL_VISIBLE_TURNS = 60;
const LOAD_OLDER_TURNS_STEP = 40;

const StreamPage: React.FC = () => {
  const {
    currentWorkspace,
    scopeMode,
    activeGroup,
    activeGroupOwnerId,
    groups,
    scopeHydrated,
  } = useWorkspace();
  const {
    owner: scopeOwner,
    needsOwner: scopeNeedsOwner,
    ready: scopeOwnerReady,
  } = useResolvedScopeOwner();
  const scopeReady =
    scopeMode === "group"
      ? !!activeGroup?.trim()
      : !!currentWorkspace?.trim();

  const chatSessions = useChatSessions({
    scopeMode,
    workspaceName: currentWorkspace,
    groupName: activeGroup,
    owner: scopeOwner,
    enabled: scopeReady && scopeOwnerReady && scopeHydrated,
  });

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [resolvedWorkspace, setResolvedWorkspace] = useState<string | null>(null);
  const [workspaceKey, setWorkspaceKey] = useState<string | null>(null);
  const [connectKey, setConnectKey] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [agentBusy, setAgentBusy] = useState(false);
  const [isQueued, setIsQueued] = useState(false);
  const [sessionsSheetOpen, setSessionsSheetOpen] = useState(false);
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

  const { incognito, activeSessionId, activeSessionTitle } = chatSessions;

  const streamActive = isStreaming || agentBusy || isQueued;
  const isConnected =
    connectionState === "connected" || connectionState === "reconnecting";

  const isInputEnabled =
    !streamActive &&
    !isLoadingHistory &&
    !chatSessions.loading &&
    isConnected &&
    scopeReady &&
    !!connectKey;
  const canSend =
    isInputEnabled &&
    !agentBusy &&
    currentInput.trim().length > 0 &&
    !!workspaceKey &&
    !!connectKey;

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
        if (behavior === "smooth") {
          suppressScrollAwayRef.current = true;
          window.setTimeout(() => {
            suppressScrollAwayRef.current = false;
            updateScrollAffordances();
          }, 400);
        }
        scrollMessagesToBottom(behavior);
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

  const buildConnectKey = useCallback(() => {
    if (!chatSessions.chatKey) return null;
    try {
      const mode = resolveChatConnectMode(incognito, activeSessionId);
      return `${chatSessions.chatKey}|${
        mode.kind === "incognito" ? "incognito" : mode.sessionId
      }`;
    } catch {
      return null;
    }
  }, [chatSessions.chatKey, incognito, activeSessionId]);

  const loadChat = useCallback(
    async (requestId: number) => {
      try {
        if (chatSessions.loading) return;
        if (incognito) {
          const chatKey = chatSessions.chatKey;
          if (!chatKey || requestId !== chatLoadRequestIdRef.current) return;
          setWorkspaceKey(chatKey);
          setConnectKey(buildConnectKey());
          setResolvedWorkspace(
            scopeMode === "group" && activeGroup
              ? `group: ${activeGroup}`
              : currentWorkspace
          );
          setTurns([]);
          setVisibleFromIndex(0);
          setLoadError(null);
          return;
        }
        if (!activeSessionId) {
          throw new Error("No chat session selected.");
        }
        const { chatKey, workspace, turns: history } = await loadChatTurns(
          scopeMode,
          currentWorkspace,
          activeGroup,
          activeSessionId,
          scopeOwner
        );
        if (requestId !== chatLoadRequestIdRef.current) return;
        setWorkspaceKey(chatKey);
        setConnectKey(buildConnectKey());
        setResolvedWorkspace(workspace);
        setTurns(history);
        setVisibleFromIndex(Math.max(0, history.length - INITIAL_VISIBLE_TURNS));
        setLoadError(null);
      } catch (error) {
        if (requestId !== chatLoadRequestIdRef.current) return;
        console.error("Failed to load chat:", error);
        setWorkspaceKey(null);
        setConnectKey(null);
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
    [
      scopeMode,
      currentWorkspace,
      activeGroup,
      scopeOwner,
      incognito,
      activeSessionId,
      chatSessions.loading,
      chatSessions.chatKey,
      buildConnectKey,
    ]
  );

  const finishTurnsWithSaved = useCallback(
    (saved?: ChatPartialSaved) => {
      if (incognito && saved?.content) {
        setTurns((prev) => applyPartialSavedToTurns(prev, saved.content));
      }
    },
    [incognito]
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
    async (
      liveBlocks?: ChatBlock[],
      options?: { fullReplace?: boolean; saved?: ChatPartialSaved }
    ) => {
      const gen = ++syncGenRef.current;
      try {
        if (incognito) {
          finishTurnsWithSaved(options?.saved ?? chatClientRef.current?.getLastSaved());
          return;
        }
        if (!activeSessionId) return;

        const { turns: history, workspace } = await loadChatTurns(
          scopeMode,
          currentWorkspace,
          activeGroup,
          activeSessionId,
          scopeOwner
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
        void chatSessions.refreshSessions();
      } catch (error) {
        if (gen !== syncGenRef.current) return;
        console.error("Failed to sync chat after reconnect:", error);
      }
    },
    [
      scopeMode,
      currentWorkspace,
      activeGroup,
      scopeOwner,
      incognito,
      activeSessionId,
      finishTurnsWithSaved,
      chatSessions.refreshSessions,
    ]
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
    if (!workspaceKey || !connectKey || isLoadingHistory) return;

    let connectMode;
    try {
      connectMode = resolveChatConnectMode(incognito, activeSessionId);
    } catch {
      return;
    }

    const client = new ChatWebSocketClient(
      workspaceKey,
      connectMode,
      {
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
      onQueuedChange: (queued) => {
        setIsQueued(queued);
      },
      onQueued: (message) => {
        if (message) {
          toast.info(message, { id: "chat-queue" });
        }
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
      onCancelled: (saved) => {
        setIsStopping(false);
        setIsQueued(false);
        streamHandlersRef.current.setIsStreaming(false);
        streamHandlersRef.current.setAgentBusy(false);
        toast.dismiss("chat-reconnect");
        toast.dismiss("chat-stop");
        toast.dismiss("chat-queue");
        setTurns((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = { ...last, isStreaming: false };
          }
          return applyPartialSavedToTurns(next, saved?.content);
        });
        void streamHandlersRef.current.syncChatFromServer(undefined, {
          fullReplace: true,
          saved,
        });
      },
      onBlocksChange: (blocks) => {
        streamHandlersRef.current.applyStreamBlocks(blocks);
      },
      onCompressed: () => {
        if (!incognito) {
          toast.info("Context compressed", {
            description:
              "Older context was summarized server-side. History shown is unchanged.",
          });
        }
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
      onInterrupted: (saved) => {
        setIsStopping(false);
        setIsQueued(false);
        streamHandlersRef.current.setIsStreaming(false);
        streamHandlersRef.current.setAgentBusy(false);
        toast.dismiss("chat-reconnect");
        toast.dismiss("chat-queue");
        toast.warning(
          incognito
            ? "Stream interrupted — partial reply kept locally"
            : "Stream interrupted — partial reply saved"
        );
        void streamHandlersRef.current.syncChatFromServer(undefined, {
          fullReplace: true,
          saved,
        });
      },
      onError: (message, code) => {
        setIsStopping(false);
        setIsQueued(false);
        streamHandlersRef.current.setIsStreaming(false);
        streamHandlersRef.current.setAgentBusy(false);
        toast.dismiss("chat-queue");
        if (code === "chat_queue_timeout") {
          toast.error(
            message ||
              "Timed out waiting for a free chat slot. Try again shortly.",
            { id: "chat-queue" }
          );
        } else {
          toast.error(message, { id: "chat-reconnect" });
        }
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
      },
      scopeOwner
    );

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
      setIsQueued(false);
      showReconnectToastRef.current = false;
    };
  }, [
    workspaceKey,
    connectKey,
    isLoadingHistory,
    incognito,
    activeSessionId,
    scopeOwner,
  ]);

  useEffect(() => {
    if (!scopeReady || !scopeOwnerReady) {
      chatLoadRequestIdRef.current += 1;
      setIsLoadingHistory(false);
      setLoadError(
        scopeNeedsOwner && !scopeOwner
          ? "Multiple workspaces share this name — pick one from the workspace menu (name · owner)."
          : chatSessions.error
      );
      setTurns([]);
      setWorkspaceKey(null);
      setConnectKey(null);
      setResolvedWorkspace(null);
      return;
    }
    if (chatSessions.loading) {
      setIsLoadingHistory(true);
      return;
    }
    if (chatSessions.error) {
      setLoadError(chatSessions.error);
      setIsLoadingHistory(false);
      return;
    }
    if (!incognito && !activeSessionId) {
      setIsLoadingHistory(true);
      return;
    }

    cancelRef.current?.();
    cancelRef.current = null;
    chatClientRef.current?.destroy();
    chatClientRef.current = null;
    setConnectionState("disconnected");
    setAgentBusy(false);
    setIsStreaming(false);
    setIsQueued(false);
    const requestId = ++chatLoadRequestIdRef.current;
    setIsLoadingHistory(true);
    setLoadError(null);
    setTurns([]);
    setVisibleFromIndex(0);
    setWorkspaceKey(null);
    setConnectKey(null);
    setResolvedWorkspace(null);
    userScrolledAwayRef.current = false;
    setShowScrollToBottom(false);
    prevLoadingHistoryRef.current = true;
    void loadChat(requestId);
  }, [
    scopeReady,
    scopeOwnerReady,
    scopeNeedsOwner,
    scopeOwner,
    scopeMode,
    currentWorkspace,
    activeGroup,
    loadChat,
    chatSessions.loading,
    chatSessions.error,
    incognito,
    activeSessionId,
  ]);

  useEffect(() => {
    return () => {
      cancelRef.current?.();
      cancelRef.current = null;
      scrollOnStreamRef.current?.cancel();
    };
  }, []);

  const handleClearMessages = async () => {
    if (streamActive || !workspaceKey || incognito || !activeSessionId) return;
    if (
      !window.confirm(
        "Clear all messages in this conversation? The conversation will remain."
      )
    ) {
      return;
    }
    try {
      await clearChatSessionMessages(
        scopeMode,
        currentWorkspace,
        activeGroup,
        activeSessionId,
        scopeOwner
      );
      toast.success("Messages cleared");
      const requestId = ++chatLoadRequestIdRef.current;
      setIsLoadingHistory(true);
      await loadChat(requestId);
      void chatSessions.refreshSessions();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to clear messages"
      );
    }
  };

  const handleIncognitoChange = (checked: boolean) => {
    if (streamActive) return;
    chatSessions.setIncognito(checked);
    if (checked) setSessionsSheetOpen(false);
  };

  const handleSelectSession = (sessionId: string) => {
    if (streamActive) return;
    chatSessions.selectSession(sessionId);
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

      if (!incognito && activeSessionId) {
        const { turns: history, workspace } = await loadChatTurns(
          scopeMode,
          currentWorkspace,
          activeGroup,
          activeSessionId,
          scopeOwner
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
        void chatSessions.refreshSessions();
      } else {
        setTurns((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = { ...last, isStreaming: false };
          }
          return next;
        });
      }
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
    incognito,
    activeSessionId,
    chatSessions.refreshSessions,
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
    () =>
      groups.find(
        (g) =>
          g.name === activeGroup &&
          (activeGroupOwnerId == null || g.owner_id === activeGroupOwnerId)
      ) ?? null,
    [groups, activeGroup, activeGroupOwnerId]
  );

  const groupDisplayLabel = useMemo(() => {
    if (!activeGroup) return null;
    return formatScopedResourceLabel(
      activeGroup,
      activeGroupMeta?.owner_username,
      {
        duplicateNames: duplicateNamesInList(groups),
        multiOwnerList: listHasMultipleOwners(groups),
      }
    );
  }, [activeGroup, activeGroupMeta, groups]);

  const emptyState = useMemo(() => {
    if (scopeMode === "workspace" && !currentWorkspace?.trim()) return "no-workspace";
    if (scopeMode === "group" && !activeGroup?.trim()) return "no-group";
    if (chatSessions.loading || isLoadingHistory) return "loading";
    if (loadError || chatSessions.error) return "error";
    if (turns.length === 0) return "empty";
    return "ready";
  }, [
    scopeMode,
    currentWorkspace,
    activeGroup,
    isLoadingHistory,
    chatSessions.loading,
    chatSessions.error,
    loadError,
    turns.length,
  ]);

  const displayTarget =
    resolvedWorkspace ??
    (scopeMode === "group" ? groupDisplayLabel : currentWorkspace) ??
    "—";

  const chatBanner = useMemo((): ChatBanner | null => {
    if (connectionState === "reconnecting") {
      return {
        message:
          reconnectAttempt > 0
            ? `Reconnecting (attempt ${reconnectAttempt})…`
            : "Reconnecting — agent may still be running…",
        variant: "warning",
        spinning: true,
      };
    }
    if (isQueued) {
      return {
        message: "Waiting for a free chat slot — cancel to leave the queue",
        variant: "warning",
        spinning: true,
      };
    }
    if (
      agentBusy &&
      connectionState === "connected" &&
      !isStreaming &&
      !isQueued
    ) {
      return {
        message: "Agent busy on this session — wait before sending another message",
        variant: "default",
        spinning: true,
      };
    }
    if (scopeNeedsOwner && !scopeOwner) {
      return {
        message:
          "Multiple workspaces named the same — pick one from the navbar (name · owner)",
        variant: "warning",
      };
    }
    if (loadError || chatSessions.error) {
      return {
        message: loadError ?? chatSessions.error ?? "Could not load chat",
        variant: "destructive",
      };
    }
    return null;
  }, [
    connectionState,
    reconnectAttempt,
    isQueued,
    agentBusy,
    isStreaming,
    scopeNeedsOwner,
    scopeOwner,
    loadError,
    chatSessions.error,
  ]);

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 flex-1 flex-col overflow-hidden",
        chatPageCanvasClass
      )}
    >
      <ChatSessionsSheet
        open={sessionsSheetOpen}
        onOpenChange={setSessionsSheetOpen}
        sessions={chatSessions.sessions}
        activeSessionId={activeSessionId}
        incognito={incognito}
        loading={chatSessions.loading}
        disabled={streamActive}
        onSelectSession={handleSelectSession}
        onNewChat={async (title) => {
          await chatSessions.createSession(title);
        }}
        onRenameSession={chatSessions.renameSession}
        onDeleteSession={chatSessions.deleteSession}
      />
      <CitationSplitLayout className="min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <ChatPageToolbar
            scopeMode={scopeMode}
            displayTarget={displayTarget}
            activeGroup={activeGroup}
            activeGroupMeta={activeGroupMeta}
            incognito={incognito}
            activeSessionTitle={activeSessionTitle}
            streamActive={streamActive}
            banner={chatBanner}
            showRetry={Boolean(loadError || chatSessions.error)}
            canClear={
              !streamActive && !!workspaceKey && !incognito && !!activeSessionId
            }
            onIncognitoChange={handleIncognitoChange}
            onOpenSessions={() => setSessionsSheetOpen(true)}
            onRetry={() => {
              const requestId = ++chatLoadRequestIdRef.current;
              setIsLoadingHistory(true);
              void loadChat(requestId);
            }}
            onClearMessages={() => void handleClearMessages()}
          />

          <div className="relative min-h-0 flex-1">
            <div
              ref={messagesRef}
              onScroll={onMessagesScroll}
              className="h-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-3 sm:px-4"
            >
              <CitationChatAlign
                maxWidthClass={CHAT_THREAD_MAX_CLASS}
                className={cn(
                  "flex min-h-full flex-col py-3 sm:py-4",
                  emptyState === "ready" ? "space-y-4" : ""
                )}
              >
                {emptyState === "no-workspace" && (
                  <div className="flex flex-1 items-center justify-center py-6">
                    <Alert className="max-w-md">
                      <AlertTitle>Select a workspace</AlertTitle>
                      <AlertDescription className="text-sm">
                        Use the workspace menu in the navbar, or switch to Group
                        scope above.
                      </AlertDescription>
                    </Alert>
                  </div>
                )}

                {emptyState === "no-group" && (
                  <div className="flex flex-1 items-center justify-center py-6">
                    <Alert className="max-w-md">
                      <AlertTitle>Select a group</AlertTitle>
                      <AlertDescription className="text-sm">
                        Create a group on Workspaces, then pick it in the scope
                        control above.
                      </AlertDescription>
                    </Alert>
                  </div>
                )}

                {emptyState === "loading" && (
                  <div className="flex flex-1 items-center justify-center gap-2 py-6 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Loading chat…</span>
                  </div>
                )}

                {emptyState === "error" && !chatBanner && (
                  <div className="flex flex-1 items-center justify-center py-6">
                    <Alert variant="destructive" className="max-w-md">
                      <AlertTitle>Could not load chat</AlertTitle>
                      <AlertDescription>
                        {loadError ?? chatSessions.error}
                      </AlertDescription>
                    </Alert>
                  </div>
                )}

                {emptyState === "empty" && (
                  <div className="flex flex-1 flex-col items-center justify-center py-8 text-center text-muted-foreground">
                    <Bot className="mb-3 h-10 w-10 opacity-30" />
                    <p className="text-base font-medium text-foreground">
                      How can I help?
                    </p>
                    <p className="mt-1 max-w-sm text-sm">
                      {incognito
                        ? "Private mode — nothing is saved."
                        : `Ask about ${displayTarget}. Answers use your knowledge graph.`}
                    </p>
                  </div>
                )}

                {hiddenTurnCount > 0 && (
                  <div className="flex justify-center py-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={showOlderMessages}
                    >
                      Load {hiddenTurnCount} older
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

                <div ref={scrollEndRef} className="h-px shrink-0" />
              </CitationChatAlign>
            </div>

            {showScrollToBottom && emptyState === "ready" ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="pointer-events-auto h-8 w-8 rounded-full border border-border/60 bg-background shadow-md hover:bg-background"
                  onClick={handleScrollToBottom}
                  aria-label="Scroll to latest messages"
                  title="Jump to latest"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </div>

          <footer className="shrink-0 border-t border-border/40 bg-background px-3 pb-2 pt-2 sm:px-4">
            <CitationChatAlign maxWidthClass={CHAT_COMPOSER_MAX_CLASS}>
              <ChatComposerBar
                value={currentInput}
                onChange={setCurrentInput}
                onKeyDown={handleKeyDown}
                onSend={handleSend}
                onStop={handleStop}
                placeholder={
                  isQueued
                    ? "Waiting for a free chat slot…"
                    : scopeMode === "group"
                      ? `Message ${activeGroup ?? "group"}…`
                      : `Message ${displayTarget}…`
                }
                textareaRef={textareaRef}
                disabled={!isInputEnabled || !workspaceKey}
                canSend={canSend}
                isStreaming={streamActive}
                isStopping={isStopping}
                statusLabel={
                  isQueued
                    ? "Waiting for slot"
                    : isStreaming
                      ? "Generating"
                      : connectionState !== "connected" &&
                          connectionState !== "reconnecting"
                        ? "Offline"
                        : undefined
                }
              />
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
