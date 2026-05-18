"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Brain,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Sparkles,
  Wrench,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatBlock } from "@/lib/chatTypes";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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

function activitySummary(activitySegments: ActivitySegment[]) {
  const thinkingCount = activitySegments.filter((s) => s.kind === "thinking").length;
  const toolCalls = activitySegments
    .filter((s): s is Extract<ActivitySegment, { kind: "tools" }> => s.kind === "tools")
    .reduce((n, s) => n + s.tools.length, 0);
  const parts: string[] = [];
  if (thinkingCount > 0) {
    parts.push(`${thinkingCount} thinking`);
  }
  if (toolCalls > 0) {
    parts.push(`${toolCalls} tool${toolCalls === 1 ? "" : "s"}`);
  }
  return parts.join(" · ");
}

interface ActivityTreeProps {
  segments: ActivitySegment[];
  onToggle: (id: string) => void;
  isExpanded: (seg: ActivitySegment) => boolean;
}

function ActivityTree({ segments, onToggle, isExpanded }: ActivityTreeProps) {
  return (
    <div className="space-y-0.5 py-1">
      {segments.map((seg, segIndex) => {
        const isLastSeg = segIndex === segments.length - 1;
        const open = isExpanded(seg);

        if (seg.kind === "thinking") {
          const showContent = open && (seg.content || seg.isStreaming);
          return (
            <div key={seg.id} className="min-w-0">
              <button
                type="button"
                onClick={() => onToggle(seg.id)}
                className="flex w-full items-center gap-1 py-0.5 text-left hover:bg-muted/40 rounded-sm pr-1 transition-colors"
              >
                <TreeGuide isLast={isLastSeg && !showContent} />
                <ChevronRight
                  className={cn(
                    "h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-200",
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
                <div className="ml-6 pl-2 border-l border-muted-foreground/15 mb-1 animate-in fade-in-0 slide-in-from-top-1 duration-200">
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
          const running = seg.tools.some((t) => t.status === "running");
          return (
            <div key={seg.id} className="min-w-0">
              <button
                type="button"
                onClick={() => onToggle(seg.id)}
                className="flex w-full items-center gap-1 py-0.5 text-left hover:bg-muted/40 rounded-sm pr-1 transition-colors"
              >
                <TreeGuide isLast={isLastSeg && !showTools} />
                <ChevronRight
                  className={cn(
                    "h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-200",
                    showTools && "rotate-90"
                  )}
                />
                <Wrench className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Tools ({seg.tools.length})</span>
                {running && (
                  <Loader2 className="h-3 w-3 ml-1 animate-spin text-muted-foreground" />
                )}
              </button>
              {showTools && (
                <div className="ml-6 pl-2 border-l border-muted-foreground/15 space-y-0.5 mb-1 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                  {seg.tools.map((tool, toolIndex) => {
                    const isLastTool = toolIndex === seg.tools.length - 1;
                    return (
                      <div key={tool.id} className="flex items-center gap-1 py-0.5 min-w-0">
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
  );
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

  const activitySegments = segments.filter(
    (s) => s.kind === "thinking" || s.kind === "tools"
  );
  const responseSegments = segments.filter((s) => s.kind === "response");
  const errorSegments = segments.filter((s) => s.kind === "error");

  const hasResponse = responseSegments.length > 0;
  const responseStreaming =
    isStreaming || responseSegments.some((s) => s.isStreaming);
  const shouldBundleActivity = activitySegments.length > 0 && hasResponse;

  const summary = useMemo(() => activitySummary(activitySegments), [activitySegments]);
  const activityStillRunning = activitySegments.some(
    (s) =>
      (s.kind === "thinking" && s.isStreaming) ||
      (s.kind === "tools" && s.tools.some((t) => t.status === "running"))
  );

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [activityOpen, setActivityOpen] = useState(false);
  const wasBundledRef = useRef(false);

  useEffect(() => {
    if (!shouldBundleActivity) {
      wasBundledRef.current = false;
      setExpanded((prev) => {
        const next = { ...prev };
        for (const seg of activitySegments) {
          const isActive = seg.id === activeId;
          if (isActive) next[seg.id] = true;
          else if (activeId) next[seg.id] = false;
        }
        return next;
      });
      return;
    }

    if (!wasBundledRef.current) {
      wasBundledRef.current = true;
      setActivityOpen(false);
      setExpanded({});
    }
  }, [activeId, activitySegments, shouldBundleActivity]);

  const isExpanded = (seg: ActivitySegment) => {
    if (expanded[seg.id] !== undefined) return expanded[seg.id];
    return seg.id === activeId;
  };

  const toggle = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (segments.length === 0 && isStreaming && blocks.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Working…</span>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-2 font-chat text-[13px]">
      {activitySegments.length > 0 && (
        <>
          {shouldBundleActivity ? (
            <Collapsible open={activityOpen} onOpenChange={setActivityOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border border-border/60",
                    "bg-muted/25 px-3 py-2 text-left text-xs transition-colors",
                    "hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                >
                  <ChevronRight
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
                      activityOpen && "rotate-90"
                    )}
                  />
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-400" />
                  <span className="font-medium text-foreground/90">Reasoning & tools</span>
                  {summary ? (
                    <span className="truncate text-muted-foreground">{summary}</span>
                  ) : null}
                  <span className="ml-auto flex shrink-0 items-center gap-1.5">
                    {activityStillRunning || responseStreaming ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="overflow-hidden">
                <div className="mt-1.5 rounded-md border border-border/50 bg-muted/15 pl-1">
                  <ActivityTree
                    segments={activitySegments}
                    onToggle={toggle}
                    isExpanded={isExpanded}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <div className="rounded-md border-l-2 border-violet-500/25 bg-violet-500/5 pl-1 py-1">
              <ActivityTree
                segments={activitySegments}
                onToggle={toggle}
                isExpanded={(seg) => {
                  if (expanded[seg.id] !== undefined) return expanded[seg.id];
                  return seg.id === activeId;
                }}
              />
            </div>
          )}
        </>
      )}

      {responseSegments.map((seg) => (
        <div key={seg.id} className="min-w-0">
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
