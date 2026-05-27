"use client";

import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  className?: string;
}

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
  className,
}: ChatComposerBarProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {isStreaming && (
        <div
          className="flex items-center justify-between gap-3 rounded-xl border border-violet-500/20 bg-violet-500/[0.06] px-3 py-2"
          role="status"
          aria-live="polite"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <PrajnaStreamGlyph size="sm" className="shrink-0 opacity-90" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground leading-tight">
                {isStopping ? "Stopping…" : "Generating response"}
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                {isStopping
                  ? "Waiting for the agent to finish"
                  : "You can stop at any time"}
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
          "flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm transition-[border-color,box-shadow] duration-300",
          isStreaming
            ? "border-violet-500/25 shadow-[0_0_0_1px_rgba(139,92,246,0.08)]"
            : "border-border"
        )}
      >
        <Textarea
          ref={textareaRef}
          placeholder={
            isStreaming ? "Reply in progress — use Stop above to cancel…" : placeholder
          }
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          rows={1}
          className="min-h-[44px] max-h-40 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-60"
        />
        {!isStreaming && (
          <Button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
            title="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
