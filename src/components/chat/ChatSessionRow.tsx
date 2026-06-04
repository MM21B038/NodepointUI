"use client";

import {
  Check,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sessionDisplayTitle, type ChatSessionMeta } from "@/database/chatStorage";
import { brand } from "@/lib/brandColors";
import { cn } from "@/lib/utils";

function formatRelativeTime(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export interface ChatSessionRowProps {
  session: ChatSessionMeta;
  isActive: boolean;
  disabled?: boolean;
  variant?: "list" | "card";
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export function ChatSessionRow({
  session,
  isActive,
  disabled = false,
  variant = "card",
  onSelect,
  onRename,
  onDelete,
}: ChatSessionRowProps) {
  const title = sessionDisplayTitle(session.title);
  const timeLabel = formatRelativeTime(session.updated_at ?? session.created_at);
  const count =
    typeof session.message_count === "number"
      ? session.message_count
      : undefined;

  if (variant === "list") {
    return (
      <div
        className={cn(
          "group flex items-center gap-1 rounded-lg border px-2 py-1.5 transition-colors",
          isActive
            ? "border-brand-chat/40 bg-brand-chat/5"
            : "border-transparent hover:border-border/60 hover:bg-muted/50"
        )}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-start gap-2 text-left disabled:opacity-50"
        >
          <MessageSquare
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0",
              isActive ? brand.chat.text : "text-muted-foreground"
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight">{title}</p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {timeLabel}
              {count !== undefined ? ` · ${count} msgs` : null}
            </p>
          </div>
        </button>
        <SessionRowMenu
          disabled={disabled}
          title={title}
          onRename={onRename}
          onDelete={onDelete}
        />
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => {
        if (!disabled) onSelect();
      }}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group relative flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-chat/30 focus-visible:ring-offset-1",
        disabled && "pointer-events-none opacity-50",
        isActive
          ? cn(
              "border-chat-surface-user-border bg-chat-surface-user shadow-sm",
              "border-l-[3px] border-l-brand-chat pl-[calc(0.75rem-2px)]"
            )
          : "border-border/50 border-l-[3px] border-l-transparent bg-chat-surface-elevated hover:border-border hover:shadow-sm"
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
          isActive
            ? cn(brand.chat.border, brand.chat.bg)
            : "border-border/50 bg-background"
        )}
      >
        {isActive ? (
          <Check className={cn("h-4 w-4", brand.chat.text)} aria-hidden />
        ) : (
          <MessageSquare className="h-4 w-4 text-muted-foreground" aria-hidden />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {title}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {timeLabel || "No activity yet"}
          {count !== undefined && count > 0 ? ` · ${count} messages` : null}
        </p>
      </div>

      <div
        className="shrink-0"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <SessionRowMenu
          disabled={disabled}
          title={title}
          onRename={onRename}
          onDelete={onDelete}
          triggerClassName="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 data-[state=open]:opacity-100"
        />
      </div>
    </div>
  );
}

function SessionRowMenu({
  disabled,
  title,
  onRename,
  onDelete,
  triggerClassName,
}: {
  disabled: boolean;
  title: string;
  onRename: () => void;
  onDelete: () => void;
  triggerClassName?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8 shrink-0 text-muted-foreground", triggerClassName)}
          disabled={disabled}
          aria-label={`Actions for ${title}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={onRename} disabled={disabled}>
          <Pencil className="mr-2 h-3.5 w-3.5" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onDelete}
          disabled={disabled}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
