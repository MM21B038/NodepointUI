"use client";

import React, { useState } from "react";
import {
  Brain,
  Wrench,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatBlock } from "@/lib/chatTypes";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ChatBlockViewProps {
  block: ChatBlock;
}

function ThinkingBlock({ block }: { block: Extract<ChatBlock, { kind: "thinking" }> }) {
  const [open, setOpen] = useState(Boolean(block.isStreaming));

  React.useEffect(() => {
    if (block.isStreaming) setOpen(true);
    else setOpen(false);
  }, [block.isStreaming]);

  if (!block.content && !block.isStreaming) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-2">
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-left text-sm hover:bg-violet-500/10 transition-colors">
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-violet-600" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-violet-600" />
        )}
        <Brain className="h-4 w-4 shrink-0 text-violet-600" />
        <span className="font-medium text-violet-700 dark:text-violet-300">Thinking</span>
        {block.isStreaming && (
          <Loader2 className="ml-auto h-3 w-3 animate-spin text-violet-500" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 rounded-lg border border-violet-500/10 bg-muted/40 px-3 py-2">
        <pre className="whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground max-h-48 overflow-y-auto">
          {block.content}
          {block.isStreaming && (
            <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-violet-500/60 animate-pulse align-middle" />
          )}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ToolCallRow({ block }: { block: Extract<ChatBlock, { kind: "tool_call" }> }) {
  const isRunning = block.status === "running";
  const isCompleted = block.status === "completed";
  const isFailed = block.status === "failed";

  return (
    <div
      className={cn(
        "mb-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
        isCompleted && "border-emerald-500/35 bg-emerald-500/8",
        isFailed && "border-red-500/35 bg-red-500/8",
        isRunning && "border-border bg-muted/30"
      )}
    >
      <Wrench
        className={cn(
          "h-4 w-4 shrink-0",
          isCompleted && "text-emerald-600",
          isFailed && "text-red-600",
          isRunning && "text-muted-foreground"
        )}
      />
      <span
        className={cn(
          "font-mono font-medium truncate",
          isCompleted && "text-emerald-800 dark:text-emerald-200",
          isFailed && "text-red-800 dark:text-red-200"
        )}
      >
        {block.toolName}
      </span>
      <span className="ml-auto shrink-0">
        {isRunning && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {isCompleted && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
        {isFailed && <XCircle className="h-4 w-4 text-red-600" />}
      </span>
    </div>
  );
}

export function ChatBlockView({ block }: ChatBlockViewProps) {
  switch (block.kind) {
    case "thinking":
      return <ThinkingBlock block={block} />;

    case "response":
      if (!block.content && !block.isStreaming) return null;
      return (
        <ChatMarkdown content={block.content} isStreaming={block.isStreaming} />
      );

    case "tool_calls":
      return (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          <Search className="h-4 w-4 shrink-0 text-amber-600" />
          <span>Searching knowledge graph…</span>
        </div>
      );

    case "tool_call":
      return <ToolCallRow block={block} />;

    case "tool_result":
      return null;

    case "status":
      return (
        <p className="mb-1 text-xs text-muted-foreground">
          {block.label}
          {block.detail ? ` · ${block.detail}` : ""}
        </p>
      );

    case "error":
      return (
        <div className="mb-2 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{block.message}</span>
        </div>
      );

    default:
      return null;
  }
}
