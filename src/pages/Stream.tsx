"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Bot,
  Globe,
  Loader2,
  Send,
  User,
  Trash2,
  RefreshCw,
  FolderOpen,
} from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  loadChatTurns,
  sendChatTurn,
  clearChat,
  getStoredChatScope,
  setStoredChatScope,
  type ChatScope,
} from "@/database/chatStorage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { ChatTurn } from "@/lib/chatTypes";
import { createEmptyAssistantTurn } from "@/lib/chatStreamReducer";
import { AssistantActivityView } from "@/components/chat/AssistantActivityView";
import { CitationTag } from "@/components/chat/CitationTag";
import { CopyButton } from "@/components/chat/CopyButton";
import { getAssistantResponseText } from "@/lib/chatCopyText";
import { createBlockId } from "@/lib/chatTypes";
import { toast } from "sonner";

const TEXTAREA_MAX_HEIGHT = 160;
/** Message thread max width */
const CHAT_THREAD_MAX_CLASS = "max-w-6xl";
/** Composer bar max width (slightly narrower than thread) */
const CHAT_COMPOSER_MAX_CLASS = "max-w-4xl";

const Stream: React.FC = () => {
  const { currentWorkspace } = useWorkspace();
  const [chatScope, setChatScope] = useState<ChatScope>(() => getStoredChatScope());
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [resolvedWorkspace, setResolvedWorkspace] = useState<string | null>(null);
  const [workspaceKey, setWorkspaceKey] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentInput, setCurrentInput] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  const isInputEnabled =
    !isStreaming &&
    !isLoadingHistory &&
    (chatScope === "global" || !!currentWorkspace?.trim());
  const canSend = isInputEnabled && currentInput.trim().length > 0 && !!workspaceKey;

  const scrollToBottom = useCallback(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [turns, isStreaming, scrollToBottom]);

  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [currentInput, adjustTextareaHeight]);

  const loadChat = useCallback(async () => {
    setIsLoadingHistory(true);
    setLoadError(null);
    try {
      const { chatKey, workspace, turns: history } = await loadChatTurns(
        chatScope,
        currentWorkspace
      );
      setWorkspaceKey(chatKey);
      setResolvedWorkspace(workspace);
      setTurns(history);
    } catch (error) {
      console.error("Failed to load chat:", error);
      setWorkspaceKey(null);
      setResolvedWorkspace(null);
      setTurns([]);
      setLoadError(error instanceof Error ? error.message : "Failed to load chat history");
    } finally {
      setIsLoadingHistory(false);
    }
  }, [chatScope, currentWorkspace]);

  useEffect(() => {
    if (chatScope === "workspace" && !currentWorkspace?.trim()) {
      setIsLoadingHistory(false);
      setLoadError(null);
      setTurns([]);
      setWorkspaceKey(null);
      return;
    }
    cancelRef.current?.();
    cancelRef.current = null;
    loadChat();
  }, [chatScope, currentWorkspace, loadChat]);

  useEffect(() => {
    return () => {
      cancelRef.current?.();
      cancelRef.current = null;
    };
  }, []);

  const handleScopeChange = (scope: ChatScope) => {
    if (isStreaming) return;
    setChatScope(scope);
    setStoredChatScope(scope);
  };

  const handleClearChat = async () => {
    if (isStreaming || !workspaceKey) return;
    if (!window.confirm("Clear all messages in this chat? This cannot be undone.")) return;
    try {
      await clearChat(chatScope, currentWorkspace);
      toast.success("Chat cleared");
      await loadChat();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clear chat");
    }
  };

  const handleSend = useCallback(async () => {
    const query = currentInput.trim();
    if (!query || !canSend || !workspaceKey) return;

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

    try {
      const { cancel, done } = sendChatTurn(workspaceKey, query, {
        onReady: (ready) => {
          setResolvedWorkspace(ready.workspace);
        },
        onBlocksChange: (blocks) => {
          setTurns((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "assistant" && last.isStreaming) {
              next[next.length - 1] = { ...last, blocks: [...blocks] };
            }
            return next;
          });
        },
        onCompressed: () => {
          toast.info("Context compressed", {
            description: "Older context was summarized server-side. History shown is unchanged.",
          });
        },
        onError: (message) => {
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

      cancelRef.current = cancel;
      await done;

      const { turns: history, workspace } = await loadChatTurns(chatScope, currentWorkspace);
      setResolvedWorkspace(workspace);
      setTurns(history);
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
      cancelRef.current = null;
    }
  }, [currentInput, canSend, workspaceKey, chatScope, currentWorkspace]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const emptyState = useMemo(() => {
    if (chatScope === "workspace" && !currentWorkspace?.trim()) return "no-workspace";
    if (isLoadingHistory) return "loading";
    if (loadError) return "error";
    if (turns.length === 0) return "empty";
    return "ready";
  }, [chatScope, currentWorkspace, isLoadingHistory, loadError, turns.length]);

  const displayWorkspace =
    resolvedWorkspace ??
    (chatScope === "global" ? "flagged" : currentWorkspace) ??
    "—";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 bg-background">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-base font-semibold shrink-0">Chat</h1>
          <Badge variant="secondary" className="font-normal truncate max-w-[200px]">
            {chatScope === "global" ? (
              <>
                <Globe className="h-3 w-3 mr-1 inline" />
                Flagged-scope
              </>
            ) : (
              <>
                <FolderOpen className="h-3 w-3 mr-1 inline" />
                {displayWorkspace}
              </>
            )}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={chatScope} onValueChange={(v) => handleScopeChange(v as ChatScope)}>
            <TabsList className="h-8">
              <TabsTrigger value="workspace" disabled={isStreaming} className="text-xs px-3">
                Workspace
              </TabsTrigger>
              <TabsTrigger value="global" disabled={isStreaming} className="text-xs px-3">
                Flagged
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {loadError && (
            <Button variant="outline" size="sm" className="h-8" onClick={() => loadChat()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Retry
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={handleClearChat}
            disabled={isStreaming || !workspaceKey}
            title="Clear chat history"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Clear
          </Button>
        </div>
      </header>

      <div
        ref={messagesRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-2"
      >
        <div className={cn("mx-auto w-full px-3 sm:px-6 py-6 space-y-6", CHAT_THREAD_MAX_CLASS)}>
          {emptyState === "no-workspace" && (
            <Alert>
              <AlertTitle>Select a workspace</AlertTitle>
              <AlertDescription>
                Use the workspace selector in the navbar for per-workspace chat. Or switch to{" "}
                <strong>Flagged</strong> for a separate thread that searches all starred
                workspaces.
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
                <span className="font-medium text-foreground">{displayWorkspace}</span>.
                Star at least one workspace to enable knowledge search.
              </p>
            </div>
          )}

          {turns.map((turn) => {
            const userText = turn.content?.trim() ?? "";
            const assistantText = getAssistantResponseText(turn.blocks);

            return (
            <div
              key={turn.id}
              className={cn(
                "flex gap-2 group",
                turn.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {turn.role === "assistant" && (
                <Avatar className="h-8 w-8 shrink-0 mt-0.5 ring-1 ring-border">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}

              <div
                className={cn(
                  "relative rounded-2xl px-5 py-4 shadow-sm",
                  turn.role === "user"
                    ? "max-w-[min(100%,28rem)] shrink-0 bg-primary text-primary-foreground"
                    : "flex-1 min-w-0 w-full bg-card border border-border/60 font-chat text-[15px] leading-relaxed"
                )}
              >
                {turn.role === "user" && (
                  <CopyButton
                    text={userText}
                    label="Copy message"
                    variant="ghostOnPrimary"
                    className="absolute right-1 top-1 z-10 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  />
                )}
                {turn.role === "assistant" && (
                  <CopyButton
                    text={assistantText}
                    label="Copy response"
                    className="absolute right-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  />
                )}
                {turn.role === "user" ? (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed pr-8">{turn.content}</p>
                ) : (
                  <div className="pr-8">
                    <AssistantActivityView
                      blocks={turn.blocks}
                      isStreaming={turn.isStreaming}
                    />
                  </div>
                )}
              </div>

              {turn.role === "user" && (
                <Avatar className="h-8 w-8 shrink-0 mt-0.5 ring-1 ring-border">
                  <AvatarFallback className="bg-muted">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
            );
          })}

          <div ref={scrollEndRef} className="h-px" />
        </div>
      </div>

      <footer className="shrink-0 z-20 border-t border-border bg-background shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.12)] dark:shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.45)]">
        <div className={cn("mx-auto w-full px-4 py-3", CHAT_COMPOSER_MAX_CLASS)}>
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm">
            <Textarea
              ref={textareaRef}
              placeholder={
                chatScope === "global"
                  ? "Message flagged-scope chat…"
                  : `Message ${displayWorkspace}…`
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
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-center text-muted-foreground mt-2 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
            <span>
              {chatScope === "global"
                ? "Separate from per-workspace chat · searches all starred workspaces"
                : `Workspace ${displayWorkspace} chat + starred corpora in search`}
            </span>
            <span className="text-muted-foreground/80">· Citations</span>
            <CitationTag kind="doc" label="" />
            <CitationTag kind="entity" label="" />
            <CitationTag kind="relation" label="" />
            <CitationTag kind="chunk" label="" />
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Stream;
