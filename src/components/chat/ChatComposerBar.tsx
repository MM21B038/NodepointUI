"use client";

import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  chatBrandOutlineButtonClass,
  chatComposerShellClass,
} from "@/components/chat/chatDialogStyles";
import { cn } from "@/lib/utils";
import { PrajnaStreamGlyph } from "@/components/chat/PrajnaStreamGlyph";

export interface ChatComposerBarProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onStop: () => void;
  placeholder: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  disabled: boolean;
  canSend: boolean;
  isStreaming: boolean;
  isStopping?: boolean;
  /** Override status headline when streaming (e.g. "Waiting for slot"). */
  statusLabel?: string;
  className?: string;
}

const composerTextareaClass = cn(
  "min-h-[44px] max-h-40 w-full flex-1 resize-none overflow-y-auto",
  "border-0 bg-transparent px-2 py-2.5 text-[15px] leading-snug shadow-none",
  "placeholder:text-muted-foreground/65",
  "focus-visible:ring-0 focus-visible:ring-offset-0",
  "disabled:cursor-not-allowed disabled:opacity-55"
);

export function ChatComposerBar({
  value,
  onChange,
  onKeyDown,
  onSend,
  onStop,
  placeholder,
  textareaRef,
  disabled,
  canSend,
  isStreaming,
  isStopping = false,
  statusLabel,
  className,
}: ChatComposerBarProps) {
  const statusHeadline = isStopping
    ? "Stopping…"
    : statusLabel === "Waiting for slot"
      ? "Waiting for a chat slot"
      : statusLabel === "Generating" || !statusLabel
        ? "Generating response"
        : statusLabel;
  const statusDetail = isStopping
    ? "Waiting for the agent to finish"
    : statusLabel === "Waiting for slot"
      ? "Cancel to leave the queue"
      : "You can stop at any time";

  return (
    <div className={cn("space-y-2", className)}>
      {isStreaming && (
        <div
          className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-chat-surface-elevated px-3 py-2 shadow-sm"
          role="status"
          aria-live="polite"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <PrajnaStreamGlyph size="sm" className="shrink-0 opacity-90" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground leading-tight">
                {statusHeadline}
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                {statusDetail}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onStop}
            disabled={isStopping}
            className={cn(
              "h-8 shrink-0 gap-1.5 rounded-full border-border/70 bg-background/80 px-3 text-xs font-medium shadow-sm",
              "hover:border-destructive/35 hover:bg-destructive/5 hover:text-destructive",
              "focus-visible:ring-destructive/30",
              isStopping && "opacity-70"
            )}
          >
            <span
              className={cn(
                "flex h-3.5 w-3.5 items-center justify-center rounded-[3px]",
                "bg-foreground/85 dark:bg-foreground/90"
              )}
              aria-hidden
            >
              <Square className="h-2 w-2 fill-background stroke-none" />
            </span>
            Stop
          </Button>
        </div>
      )}

      <div
        className={cn(
          chatComposerShellClass,
          isStreaming &&
            "border-brand-chat/30 shadow-[0_0_0_1px_hsl(var(--brand-chat)/0.1)] focus-within:border-brand-chat/30"
        )}
      >
        <div className="relative min-w-0 flex-1">
          <Textarea
            ref={textareaRef}
            aria-label="Message"
            placeholder={
              isStreaming
                ? "Reply in progress — use Stop above to cancel…"
                : placeholder
            }
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={disabled}
            rows={1}
            className={composerTextareaClass}
          />
          {!isStreaming && !disabled && value.length === 0 && (
            <p className="pointer-events-none absolute bottom-2.5 right-2 hidden text-[10px] text-muted-foreground/45 sm:block">
              Enter to send · Shift+Enter for newline
            </p>
          )}
        </div>
        {!isStreaming && (
          <Button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            size="icon"
            aria-label="Send message"
            className={cn(
              "mb-0.5 h-10 w-10 shrink-0 rounded-xl transition-[border-color,background-color,opacity]",
              canSend
                ? cn(
                    chatBrandOutlineButtonClass,
                    "border-brand-chat bg-brand-chat text-primary-foreground shadow-sm",
                    "hover:border-brand-chat hover:bg-brand-chat/90 hover:text-primary-foreground",
                    "[&_svg]:text-primary-foreground"
                  )
                : cn(
                    chatBrandOutlineButtonClass,
                    "opacity-45"
                  )
            )}
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
