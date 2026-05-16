"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Brain,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Wrench,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatBlock } from "@/lib/chatTypes";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";

type ToolItem = {
  id: string;
  name: string;
  status: "running" | "completed" | "failed";
};

type ActivitySegment =
  | { kind: "thinking"; id: string; content: string; isStreaming: boolean }
  | { kind: "tools"; id: string; tools: ToolItem[] }
  | { kind: "response"; id: string; content: string; isStreaming: boolean }
  | { kind: "error"; id: string; message: string };

function parseSegments(blocks: ChatBlock[]): ActivitySegment[] {
  const segments: ActivitySegment[] = [];
  let thinkingBuf: { id: string; content: string; isStreaming: boolean } | null = null;
  let toolsBuf: ToolItem[] = [];
  let toolsSegId: string | null = null;

  const flushThinking = () => {
    if (thinkingBuf && (thinkingBuf.content || thinkingBuf.isStreaming)) {
      segments.push({
        kind: "thinking",
        id: thinkingBuf.id,
        content: thinkingBuf.content,
        isStreaming: thinkingBuf.isStreaming,
      });
    }
    thinkingBuf = null;
  };

  const flushTools = () => {
    if (toolsBuf.length > 0) {
      segments.push({
        kind: "tools",
        id: toolsSegId ?? `tools-${segments.length}`,
        tools: [...toolsBuf],
      });
    }
    toolsBuf = [];
    toolsSegId = null;
  };

  for (const block of blocks) {
    switch (block.kind) {
      case "thinking": {
        flushTools();
        if (!thinkingBuf) {
          thinkingBuf = {
            id: block.id,
            content: block.content,
            isStreaming: Boolean(block.isStreaming),
          };
        } else {
          thinkingBuf.content = block.content;
          thinkingBuf.isStreaming = Boolean(block.isStreaming);
        }
        break;
      }
      case "tool_calls": {
        flushThinking();
        for (const name of block.names) {
          const exists = toolsBuf.some((t) => t.name === name && t.status === "running");
          if (!exists) {
            toolsBuf.push({
              id: `${block.id}-${name}`,
              name,
              status: "running",
            });
          }
        }
        if (!toolsSegId) toolsSegId = block.id;
        break;
      }
      case "tool_call": {
        flushThinking();
        const idx = toolsBuf.findIndex((t) => t.id === block.toolCallId);
        const item: ToolItem = {
          id: block.toolCallId,
          name: block.toolName,
          status: block.status,
        };
        if (idx >= 0) toolsBuf[idx] = item;
        else toolsBuf.push(item);
        if (!toolsSegId) toolsSegId = block.id;
        break;
      }
      case "tool_result":
        break;
      case "response": {
        flushThinking();
        flushTools();
        segments.push({
          kind: "response",
          id: block.id,
          content: block.content,
          isStreaming: Boolean(block.isStreaming),
        });
        break;
      }
      case "error": {
        flushThinking();
        flushTools();
        segments.push({ kind: "error", id: block.id, message: block.message });
        break;
      }
      case "status":
        break;
      default:
        break;
    }
  }

  flushThinking();
  flushTools();
  return segments;
}

function getActiveSegmentId(segments: ActivitySegment[], turnStreaming?: boolean): string | null {
  if (segments.length === 0) return null;
  for (let i = segments.length - 1; i >= 0; i--) {
    const s = segments[i];
    if (s.kind === "response" && (s.isStreaming || turnStreaming)) return s.id;
    if (s.kind === "thinking" && s.isStreaming) return s.id;
    if (s.kind === "tools" && s.tools.some((t) => t.status === "running")) return s.id;
  }
  if (turnStreaming) {
    const last = segments[segments.length - 1];
    return last.id;
  }
  return null;
}

function TreeGuide({ isLast }: { isLast: boolean }) {
  return (
    <span className="text-muted-foreground/45 select-none w-6 shrink-0 font-mono text-[11px] leading-5">
      {isLast ? "└─" : "├─"}
    </span>
  );
}

function StatusIcon({ status }: { status: "running" | "completed" | "failed" | "thinking" }) {
  if (status === "running" || status === "thinking") {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
  }
  if (status === "completed") {
    return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />;
  }
  return <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />;
}

interface AssistantActivityViewProps {
  blocks: ChatBlock[];
  isStreaming?: boolean;
}

export function AssistantActivityView({ blocks, isStreaming }: AssistantActivityViewProps) {
  const segments = useMemo(() => parseSegments(blocks), [blocks]);
  const activeId = useMemo(
    () => getActiveSegmentId(segments, isStreaming),
    [segments, isStreaming]
  );

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      for (const seg of segments) {
        if (seg.kind === "thinking" || seg.kind === "tools") {
          const isActive = seg.id === activeId;
          if (isActive) {
            if (next[seg.id] !== false) {
              next[seg.id] = true;
            }
          } else if (activeId && seg.id !== activeId) {
            next[seg.id] = false;
          }
        }
      }
      return next;
    });
  }, [activeId, segments]);

  const isExpanded = (seg: ActivitySegment) => {
    if (seg.kind === "response" || seg.kind === "error") return true;
    if (expanded[seg.id] !== undefined) return expanded[seg.id];
    return seg.id === activeId;
  };

  const toggle = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const activitySegments = segments.filter(
    (s) => s.kind === "thinking" || s.kind === "tools"
  );
  const responseSegments = segments.filter((s) => s.kind === "response");
  const errorSegments = segments.filter((s) => s.kind === "error");

  if (
    segments.length === 0 &&
    isStreaming &&
    blocks.length === 0
  ) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Working…</span>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-3 font-chat text-[13px]">
      {activitySegments.length > 0 && (
        <div className="rounded-md border-l-2 border-muted-foreground/20 pl-1 py-1">
          {activitySegments.map((seg, segIndex) => {
            const isLastSeg = segIndex === activitySegments.length - 1;
            const open = isExpanded(seg);

            if (seg.kind === "thinking") {
              const showContent = open && (seg.content || seg.isStreaming);
              return (
                <div key={seg.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => toggle(seg.id)}
                    className="flex w-full items-center gap-1 py-0.5 text-left hover:bg-muted/40 rounded-sm pr-1 transition-colors"
                  >
                    <TreeGuide isLast={isLastSeg && !showContent && activitySegments.length === 1} />
                    <ChevronRight
                      className={cn(
                        "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
                        open && "rotate-90"
                      )}
                    />
                    <Brain className="h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-400" />
                    <span className="text-xs text-muted-foreground">Thinking</span>
                    <span className="ml-1">
                      <StatusIcon status={seg.isStreaming ? "thinking" : "completed"} />
                    </span>
                  </button>
                  {showContent && (
                    <div className="ml-6 pl-2 border-l border-muted-foreground/15 mb-1">
                      <p className="text-xs text-muted-foreground/90 italic leading-relaxed whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                        {seg.content}
                        {seg.isStreaming && (
                          <span className="inline-block w-1 h-3 ml-0.5 bg-muted-foreground/40 animate-pulse align-middle" />
                        )}
                      </p>
                    </div>
                  )}
                </div>
              );
            }

            if (seg.kind === "tools") {
              const showTools = open;
              return (
                <div key={seg.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => toggle(seg.id)}
                    className="flex w-full items-center gap-1 py-0.5 text-left hover:bg-muted/40 rounded-sm pr-1 transition-colors"
                  >
                    <TreeGuide
                      isLast={
                        isLastSeg && !showTools && activitySegments.length === 1
                      }
                    />
                    <ChevronRight
                      className={cn(
                        "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
                        showTools && "rotate-90"
                      )}
                    />
                    <Wrench className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Tools ({seg.tools.length})
                    </span>
                    {seg.tools.some((t) => t.status === "running") && (
                      <Loader2 className="h-3 w-3 ml-1 animate-spin text-muted-foreground" />
                    )}
                  </button>
                  {showTools && (
                    <div className="ml-6 pl-2 border-l border-muted-foreground/15 space-y-0.5 mb-1">
                      {seg.tools.map((tool, toolIndex) => {
                        const isLastTool = toolIndex === seg.tools.length - 1;
                        return (
                          <div
                            key={tool.id}
                            className="flex items-center gap-1 py-0.5 min-w-0"
                          >
                            <TreeGuide isLast={isLastTool} />
                            <Wrench
                              className={cn(
                                "h-3.5 w-3.5 shrink-0",
                                tool.status === "completed" && "text-emerald-600",
                                tool.status === "failed" && "text-red-600",
                                tool.status === "running" && "text-muted-foreground"
                              )}
                            />
                            <span
                              className={cn(
                                "text-xs font-mono truncate",
                                tool.status === "completed" &&
                                  "text-emerald-800 dark:text-emerald-200",
                                tool.status === "failed" && "text-red-700 dark:text-red-300",
                                tool.status === "running" && "text-muted-foreground"
                              )}
                            >
                              {tool.name}
                            </span>
                            <span className="ml-auto shrink-0 pl-2">
                              <StatusIcon status={tool.status} />
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return null;
          })}
        </div>
      )}

      {responseSegments.map((seg) => (
        <div key={seg.id} className="min-w-0 pt-0.5">
          {(seg.content || seg.isStreaming) && (
            <ChatMarkdown content={seg.content} isStreaming={seg.isStreaming} />
          )}
        </div>
      ))}

      {errorSegments.map((seg) => (
        <div
          key={seg.id}
          className="flex items-start gap-2 text-sm text-destructive py-1"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{seg.message}</span>
        </div>
      ))}
    </div>
  );
}
