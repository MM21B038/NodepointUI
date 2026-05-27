"use client";

import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { ChatTurn } from "@/lib/chatTypes";
import { AssistantActivityView } from "@/components/chat/AssistantActivityView";
import { CopyButton } from "@/components/chat/CopyButton";
import { getAssistantResponseText } from "@/lib/chatCopyText";

export interface ChatTurnRowProps {
  turn: ChatTurn;
  isStreaming: boolean;
}

function ChatTurnRowInner({ turn, isStreaming }: ChatTurnRowProps) {
  const copyText = useMemo(() => {
    if (turn.role === "user") return turn.content?.trim() ?? "";
    return getAssistantResponseText(turn.blocks);
  }, [turn]);

  return (
    <div
      className={cn(
        "group flex [content-visibility:auto] [contain-intrinsic-size:auto_120px]",
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
                isStreaming={isStreaming}
                historyMode={!isStreaming}
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
}

/** Re-render only when this turn object or streaming flag changes. */
export const ChatTurnRow = memo(ChatTurnRowInner, (prev, next) => {
  return prev.turn === next.turn && prev.isStreaming === next.isStreaming;
});
