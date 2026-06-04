"use client";

import { useMemo, useState } from "react";
import {
  EyeOff,
  History,
  Loader2,
  MessageSquarePlus,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ChatSessionRow } from "@/components/chat/ChatSessionRow";
import {
  chatBrandInputClass,
  chatBrandOutlineButtonClass,
  chatDialogSurfaceClass,
} from "@/components/chat/chatDialogStyles";
import DeleteConfirmationDialog from "@/components/DeleteConfirmationDialog";
import {
  sessionDisplayTitle,
  type ChatSessionMeta,
} from "@/database/chatStorage";
import { brand } from "@/lib/brandColors";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface ChatSessionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: ChatSessionMeta[];
  activeSessionId: string | null;
  incognito: boolean;
  loading?: boolean;
  disabled?: boolean;
  onSelectSession: (sessionId: string) => void;
  onNewChat: (title?: string) => Promise<void>;
  onRenameSession: (sessionId: string, title: string) => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<unknown>;
}

export function ChatSessionsSheet({
  open,
  onOpenChange,
  sessions,
  activeSessionId,
  incognito,
  loading = false,
  disabled = false,
  onSelectSession,
  onNewChat,
  onRenameSession,
  onDeleteSession,
}: ChatSessionsSheetProps) {
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [search, setSearch] = useState("");
  const [renameTarget, setRenameTarget] = useState<ChatSessionMeta | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChatSessionMeta | null>(null);

  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) =>
      sessionDisplayTitle(s.title).toLowerCase().includes(q)
    );
  }, [sessions, search]);

  const handleNewChat = async () => {
    setCreating(true);
    try {
      await onNewChat(newTitle.trim() || undefined);
      setNewTitle("");
      setSearch("");
      onOpenChange(false);
      toast.success("New conversation started");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create chat");
    } finally {
      setCreating(false);
    }
  };

  const handleRenameConfirm = async () => {
    if (!renameTarget) return;
    const title = renameValue.trim();
    if (!title) {
      toast.error("Title is required");
      return;
    }
    setRenaming(true);
    try {
      await onRenameSession(renameTarget.session_id, title);
      setRenameTarget(null);
      toast.success("Conversation renamed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rename");
    } finally {
      setRenaming(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await onDeleteSession(deleteTarget.session_id);
      setDeleteTarget(null);
      toast.success("Conversation deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={chatDialogSurfaceClass}>
          <DialogHeader className="shrink-0 space-y-0 border-b border-border/60 px-5 pb-4 pt-5 text-left sm:px-6">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                  brand.chat.border,
                  brand.chat.bg
                )}
              >
                <History className={cn("h-5 w-5", brand.chat.text)} />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <DialogTitle className="text-lg font-semibold tracking-tight">
                  Conversations
                </DialogTitle>
                <DialogDescription className="mt-1 text-left text-xs leading-relaxed">
                  Switch a saved thread or start a new one. History is kept per
                  workspace or group.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-4 sm:px-6">
            {incognito ? (
              <div
                className={cn(
                  "flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-12 text-center",
                  brand.warning.border,
                  brand.warning.bg
                )}
              >
                <EyeOff className={cn("h-8 w-8", brand.warning.text)} />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Incognito is on
                  </p>
                  <p className="mt-1 max-w-[15rem] text-xs text-muted-foreground">
                    Turn off incognito in the chat header to browse saved
                    conversations.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <section
                  className="shrink-0 rounded-xl border border-border/50 bg-chat-surface-elevated p-4 shadow-sm"
                  aria-labelledby="new-conversation-heading"
                >
                  <h3
                    id="new-conversation-heading"
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    New conversation
                  </h3>
                  <div className="mt-3 space-y-3">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="new-chat-title"
                        className="text-xs font-normal text-muted-foreground"
                      >
                        Title (optional)
                      </Label>
                      <Input
                        id="new-chat-title"
                        placeholder="Research notes, Q2 review…"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        disabled={disabled || creating}
                        className={cn("h-10 rounded-lg", chatBrandInputClass)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !disabled && !creating) {
                            void handleNewChat();
                          }
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "h-10 w-full gap-2 rounded-xl",
                        chatBrandOutlineButtonClass
                      )}
                      disabled={disabled || creating}
                      onClick={() => void handleNewChat()}
                    >
                      {creating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MessageSquarePlus className="h-4 w-4" />
                      )}
                      Start new conversation
                    </Button>
                  </div>
                </section>

                <div className="mt-5 flex shrink-0 items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Saved
                  </p>
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-5 border-brand-chat/30 px-2 text-[10px] font-medium tabular-nums",
                      brand.chat.text
                    )}
                  >
                    {sessions.length}
                  </Badge>
                </div>

                <div className="relative mt-2 shrink-0">
                  <Search
                    className={cn(
                      "pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2",
                      brand.chat.text,
                      "opacity-70"
                    )}
                  />
                  <Input
                    placeholder="Search by title…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    disabled={loading || sessions.length === 0}
                    className={cn("h-9 rounded-lg pl-9 text-sm", chatBrandInputClass)}
                  />
                </div>

                <div
                  className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl border border-border/40 bg-chat-surface-canvas/60 p-2 [-webkit-overflow-scrolling:touch]"
                  role="region"
                  aria-label="Saved conversations"
                >
                  {loading ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-14 text-muted-foreground">
                      <Loader2
                        className={cn("h-6 w-6 animate-spin", brand.chat.text)}
                      />
                      <span className="text-sm">Loading…</span>
                    </div>
                  ) : sessions.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                      <MessageSquarePlus
                        className={cn("h-9 w-9 opacity-30", brand.chat.text)}
                      />
                      <p className="text-sm font-medium text-foreground">
                        No saved chats yet
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Create one with the form above.
                      </p>
                    </div>
                  ) : filteredSessions.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      No matches for &ldquo;{search.trim()}&rdquo;
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {filteredSessions.map((session) => (
                        <ChatSessionRow
                          key={session.session_id}
                          session={session}
                          variant="card"
                          isActive={session.session_id === activeSessionId}
                          disabled={disabled}
                          onSelect={() => {
                            onSelectSession(session.session_id);
                            onOpenChange(false);
                          }}
                          onRename={() => {
                            setRenameTarget(session);
                            setRenameValue(sessionDisplayTitle(session.title));
                          }}
                          onDelete={() => setDeleteTarget(session)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {!incognito && (
            <>
              <Separator className="shrink-0 bg-border/50" />
              <p className="shrink-0 bg-chat-surface-elevated/50 px-6 py-3 text-center text-[11px] leading-relaxed text-muted-foreground">
                Each workspace and group keeps its own conversation list.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(o) => {
          if (!o) setRenameTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename conversation</DialogTitle>
            <DialogDescription>
              Use a short title you will recognize later.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="session-rename">Title</Label>
            <Input
              id="session-rename"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              disabled={renaming}
              className={chatBrandInputClass}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleRenameConfirm();
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRenameTarget(null)}
              disabled={renaming}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className={cn("rounded-lg", chatBrandOutlineButtonClass)}
              onClick={() => void handleRenameConfirm()}
              disabled={renaming}
            >
              {renaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteConfirm()}
        title="Delete conversation"
        description="This permanently deletes the conversation and all messages. This cannot be undone."
        itemName={
          deleteTarget
            ? sessionDisplayTitle(deleteTarget.title)
            : undefined
        }
      />
    </>
  );
}
