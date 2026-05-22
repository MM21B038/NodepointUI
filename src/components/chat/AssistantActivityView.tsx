"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Brain,
  CheckCircle2,
  ChevronRight,
  Layers,
  Loader2,
  Wrench,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { ToolPipeline, type ToolItem } from "@/components/chat/ToolPipeline";
import {
  ThinkingPipeline,
  type ThinkingItem,
} from "@/components/chat/ThinkingPipeline";
import { cn } from "@/lib/utils";
import type { ChatBlock } from "@/lib/chatTypes";
import { reorderLateToolsBeforeResponse } from "@/lib/chatStreamReducer";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { PreStreamPlaceholder } from "@/components/chat/StreamingIndicators";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type ActivitySegment =
  | { kind: "thinking"; id: string; content: string; isStreaming: boolean }
  | { kind: "tools"; id: string; tools: ToolItem[] }
  | { kind: "response"; id: string; content: string; isStreaming: boolean }
  | { kind: "error"; id: string; message: string }
  | { kind: "cycle_boundary"; id: string };

function findToolBufIndex(
  toolsBuf: ToolItem[],
  toolCallId: string,
  toolName: string,
  status: ToolItem["status"]
): number {
  const byId = toolsBuf.findIndex((t) => t.id === toolCallId);
  if (byId >= 0) return byId;
  if (status === "running") {
    return toolsBuf.findIndex(
      (t) => t.name === toolName && t.status === "running"
    );
  }
  return -1;
}

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
        if (thinkingBuf && thinkingBuf.id !== block.id) {
          flushThinking();
        }
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
        const idx = findToolBufIndex(toolsBuf, block.toolCallId, block.toolName, block.status);
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
      case "tool_result": {
        flushThinking();
        const idx = findToolBufIndex(
          toolsBuf,
          block.toolCallId,
          block.toolName,
          block.ok ? "completed" : "failed"
        );
        const item: ToolItem = {
          id: block.toolCallId,
          name: block.toolName,
          status: block.ok ? "completed" : "failed",
        };
        if (idx >= 0) toolsBuf[idx] = item;
        else toolsBuf.push(item);
        if (!toolsSegId) toolsSegId = block.id;
        break;
      }
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
      case "cycle_boundary": {
        flushThinking();
        flushTools();
        segments.push({ kind: "cycle_boundary", id: block.id });
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
  return normalizeActivitySegments(segments);
}

/** Merge back-to-back tools segments (same think→tools round). */
function normalizeActivitySegments(segments: ActivitySegment[]): ActivitySegment[] {
  const out: ActivitySegment[] = [];
  let toolAcc: ToolItem[] = [];
  let toolAccId: string | null = null;

  const flushToolAcc = () => {
    if (toolAcc.length === 0) return;
    out.push({
      kind: "tools",
      id: toolAccId ?? `tools-${out.length}`,
      tools: toolAcc,
    });
    toolAcc = [];
    toolAccId = null;
  };

  for (const seg of segments) {
    if (seg.kind === "tools") {
      if (!toolAccId) toolAccId = seg.id;
      for (const tool of seg.tools) {
        if (!toolAcc.some((t) => t.id === tool.id)) toolAcc.push(tool);
      }
      continue;
    }
    flushToolAcc();
    out.push(seg);
  }
  flushToolAcc();
  return out;
}

function mergeToolSegmentsInRound(
  segments: ActivitySegmentOnly[]
): ActivitySegmentOnly[] {
  const out: ActivitySegmentOnly[] = [];
  let toolAcc: ToolItem[] = [];
  let toolAccId: string | null = null;

  const flushToolAcc = () => {
    if (toolAcc.length === 0) return;
    out.push({
      kind: "tools",
      id: toolAccId ?? `tools-${out.length}`,
      tools: toolAcc,
    });
    toolAcc = [];
    toolAccId = null;
  };

  for (const seg of segments) {
    if (seg.kind === "tools") {
      if (!toolAccId) toolAccId = seg.id;
      for (const tool of seg.tools) {
        if (!toolAcc.some((t) => t.id === tool.id)) toolAcc.push(tool);
      }
    } else {
      flushToolAcc();
      out.push(seg);
    }
  }
  flushToolAcc();
  return out;
}

/** One round = one thinking block plus its tool segment(s) before the next thinking. */
function activityRounds(segments: ActivitySegmentOnly[]): ActivitySegmentOnly[][] {
  const rounds: ActivitySegmentOnly[][] = [];
  let current: ActivitySegmentOnly[] = [];

  const pushRound = () => {
    if (current.length === 0) return;
    rounds.push(mergeToolSegmentsInRound(current));
    current = [];
  };

  for (const seg of segments) {
    if (seg.kind === "thinking") {
      if (current.some((s) => s.kind === "thinking")) pushRound();
      current.push(seg);
    } else if (seg.kind === "tools") {
      current.push(seg);
    }
  }
  pushRound();
  return rounds;
}

type ActivitySegmentOnly = Extract<ActivitySegment, { kind: "thinking" } | { kind: "tools" }>;

type DisplayItem =
  | { kind: "activity"; id: string; segments: ActivitySegmentOnly[] }
  | { kind: "response"; segment: Extract<ActivitySegment, { kind: "response" }> }
  | { kind: "error"; segment: Extract<ActivitySegment, { kind: "error" }> };

function hasToolsAfterLastThinking(
  segments: ActivitySegmentOnly[]
): boolean {
  let lastThinking = -1;
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i].kind === "thinking") {
      lastThinking = i;
      break;
    }
  }
  if (lastThinking < 0) return false;
  return segments.slice(lastThinking + 1).some((s) => s.kind === "tools");
}

function buildDisplayItems(segments: ActivitySegment[]): DisplayItem[] {
  const items: DisplayItem[] = [];
  let activityBuf: ActivitySegmentOnly[] = [];
  /** Tools block(s) that appeared after a response, waiting for the next thinking. */
  let pendingToolsAfterResponse: ActivitySegmentOnly[] = [];

  const flushActivity = () => {
    if (activityBuf.length === 0) return;
    const activityIndex = items.filter((i) => i.kind === "activity").length;
    items.push({
      kind: "activity",
      id: `activity-${activityIndex}`,
      segments: [...activityBuf],
    });
    activityBuf = [];
  };

  const flushPendingToolsIntoPriorActivity = () => {
    if (pendingToolsAfterResponse.length === 0) return;
    for (let j = items.length - 1; j >= 0; j--) {
      if (items[j].kind !== "response") continue;
      for (let k = j - 1; k >= 0; k--) {
        if (items[k].kind !== "activity") continue;
        const act = items[k];
        if (!hasToolsAfterLastThinking(act.segments)) {
          items[k] = {
            ...act,
            segments: [...act.segments, ...pendingToolsAfterResponse],
          };
          pendingToolsAfterResponse = [];
          return;
        }
        break;
      }
      break;
    }
    if (pendingToolsAfterResponse.length > 0) {
      activityBuf = [...pendingToolsAfterResponse];
      pendingToolsAfterResponse = [];
    }
  };

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.kind === "thinking") {
      if (pendingToolsAfterResponse.length > 0) {
        activityBuf = [seg, ...pendingToolsAfterResponse];
        pendingToolsAfterResponse = [];
      } else if (
        activityBuf.length > 0 &&
        activityBuf.every((s) => s.kind === "tools")
      ) {
        activityBuf = [seg, ...activityBuf];
      } else {
        activityBuf.push(seg);
      }
    } else if (seg.kind === "tools") {
      if (
        activityBuf.length === 0 &&
        items.length > 0 &&
        items[items.length - 1].kind === "response"
      ) {
        pendingToolsAfterResponse.push(seg);
      } else {
        activityBuf.push(seg);
      }
    } else if (seg.kind === "cycle_boundary") {
      let j = i + 1;
      while (j < segments.length && segments[j].kind === "cycle_boundary") j++;
      const next = segments[j];

      if (
        items.some((it) => it.kind === "response") &&
        activityBuf.length > 0
      ) {
        flushActivity();
        continue;
      }

      // Same model round before any response: think→tools, think→think, tools→think.
      if (activityBuf.length > 0 && next) {
        if (next.kind === "tools") continue;
        if (
          next.kind === "thinking" &&
          activityBuf.every((s) => s.kind === "thinking" || s.kind === "tools")
        ) {
          continue;
        }
      }
      flushActivity();
    } else if (seg.kind === "response") {
      flushActivity();
      items.push({ kind: "response", segment: seg });
    } else if (seg.kind === "error") {
      flushActivity();
      items.push({ kind: "error", segment: seg });
    }
  }

  flushActivity();
  flushPendingToolsIntoPriorActivity();
  if (activityBuf.length > 0) {
    flushActivity();
  }

  return items;
}

function activityGroupHasFollowingResponse(
  items: DisplayItem[],
  activityIndex: number
): boolean {
  return items.slice(activityIndex + 1).some((item) => item.kind === "response");
}

/** Activity group still streaming (thinking/tools) before any response segment exists. */
function activityGroupInProgressDuringStream(
  items: DisplayItem[],
  activityIndex: number,
  activityPhaseStreaming: boolean
): boolean {
  return (
    activityPhaseStreaming &&
    !activityGroupHasFollowingResponse(items, activityIndex)
  );
}

function shouldUseBundledActivity(
  items: DisplayItem[],
  activityIndex: number,
  activityPhaseStreaming: boolean,
  responseStreaming: boolean,
  visibleActivityDuringResponse: number | null
): boolean {
  if (activityGroupHasFollowingResponse(items, activityIndex)) return true;
  if (
    responseStreaming &&
    visibleActivityDuringResponse !== null &&
    activityIndex === visibleActivityDuringResponse
  ) {
    return true;
  }
  return activityGroupInProgressDuringStream(
    items,
    activityIndex,
    activityPhaseStreaming
  );
}

/** During response stream, only the activity group before the live response is shown. */
function activityIndexBeforeStreamingResponse(items: DisplayItem[]): number | null {
  const responseIdx = items.findIndex(
    (item) => item.kind === "response" && item.segment.isStreaming
  );
  if (responseIdx < 0) return null;
  for (let i = responseIdx - 1; i >= 0; i--) {
    if (items[i].kind === "activity") return i;
  }
  return null;
}

function getActiveSegmentId(segments: ActivitySegment[], turnStreaming?: boolean): string | null {
  if (segments.length === 0) return null;
  const last = segments[segments.length - 1];
  if (last.kind === "response" && (last.isStreaming || turnStreaming)) return last.id;
  for (let i = segments.length - 1; i >= 0; i--) {
    const s = segments[i];
    if (s.kind === "thinking" && s.isStreaming) return s.id;
    if (s.kind === "tools" && s.tools.some((t) => t.status === "running")) return s.id;
  }
  if (turnStreaming && last.kind !== "response") {
    return last.id;
  }
  return null;
}

function getActiveActivityGroupId(
  displayItems: DisplayItem[],
  activeId: string | null,
  isStreaming?: boolean
): string | null {
  if (activeId) {
    for (const item of displayItems) {
      if (item.kind !== "activity") continue;
      if (item.segments.some((s) => s.id === activeId)) return item.id;
    }
    if (isStreaming) {
      for (const item of displayItems) {
        if (item.kind === "response" && item.segment.id === activeId) return null;
      }
    }
  }
  if (isStreaming) {
    const lastActivity = [...displayItems].reverse().find((i) => i.kind === "activity");
    if (lastActivity?.kind === "activity") {
      const idx = displayItems.indexOf(lastActivity);
      if (!activityGroupHasFollowingResponse(displayItems, idx)) return lastActivity.id;
    }
  }
  return null;
}

const TIMELINE_MARK_LEFT = "left-[7px]";

function TimelineRail({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute top-4 bottom-4 w-px bg-border/60",
        TIMELINE_MARK_LEFT,
        className
      )}
      aria-hidden
    />
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

function activitySummary(activitySegments: ActivitySegmentOnly[]) {
  const rounds = activityRounds(activitySegments);
  const thinkingCount = rounds.filter((r) =>
    r.some((s) => s.kind === "thinking")
  ).length;
  const toolIds = new Set<string>();
  const perRound: number[] = [];
  for (const round of rounds) {
    let roundTools = 0;
    for (const seg of round) {
      if (seg.kind !== "tools") continue;
      for (const tool of seg.tools) {
        toolIds.add(tool.id);
        roundTools++;
      }
    }
    if (roundTools > 0) perRound.push(roundTools);
  }
  const toolCalls = toolIds.size;
  const parts: string[] = [];
  if (rounds.length > 1) {
    parts.push(`${rounds.length} rounds`);
  } else if (thinkingCount > 0) {
    parts.push(`${thinkingCount} thinking`);
  }
  if (toolCalls > 0) {
    if (perRound.length > 1) {
      parts.push(`${toolCalls} tools (${perRound.join(" + ")})`);
    } else {
      parts.push(`${toolCalls} tool${toolCalls === 1 ? "" : "s"}`);
    }
  }
  return parts.join(" · ");
}

function thinkingItemsFromSegments(
  segments: ActivitySegmentOnly[]
): ThinkingItem[] {
  return segments
    .filter((s): s is Extract<ActivitySegmentOnly, { kind: "thinking" }> => s.kind === "thinking")
    .map((s) => ({
      id: s.id,
      content: s.content,
      isStreaming: s.isStreaming,
    }));
}

interface ActivityTreeProps {
  segments: ActivitySegmentOnly[];
  activeId: string | null;
  turnStreaming?: boolean;
  responseStreaming?: boolean;
  freezeToolsList?: boolean;
  onToggle: (id: string) => void;
  isExpanded: (seg: ActivitySegmentOnly) => boolean;
  onMergedThinkingChange?: (count: number) => void;
}

function CompactActivityRound({
  roundIndex,
  segments,
}: {
  roundIndex: number;
  segments: ActivitySegmentOnly[];
}) {
  const toolCount = segments
    .filter((s): s is Extract<ActivitySegmentOnly, { kind: "tools" }> => s.kind === "tools")
    .reduce((n, s) => n + s.tools.length, 0);
  const preview = segments
    .filter((s): s is Extract<ActivitySegmentOnly, { kind: "thinking" }> => s.kind === "thinking")
    .map((s) => s.content.trim())
    .find(Boolean);

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md border border-border/40 bg-muted/20 px-2.5 py-1.5 text-xs text-muted-foreground">
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <span className="font-medium text-foreground/80">Round {roundIndex + 1}</span>
      <span className="text-border/80">·</span>
      <span>
        {toolCount} tool{toolCount === 1 ? "" : "s"}
      </span>
      {preview ? (
        <span className="min-w-0 truncate italic opacity-75">{preview}</span>
      ) : null}
    </div>
  );
}

function ActivityTree({
  segments,
  activeId,
  turnStreaming,
  responseStreaming,
  freezeToolsList,
  onToggle,
  isExpanded,
  onMergedThinkingChange,
}: ActivityTreeProps) {
  const [mergedBySegment, setMergedBySegment] = useState<Record<string, number>>({});
  const hideMainTimelineRail = Boolean(turnStreaming && !responseStreaming);
  const activityPhaseStreaming = Boolean(turnStreaming && !responseStreaming);
  const rounds = activityRounds(segments);
  const showRoundLabels = rounds.length > 1;
  const lastRoundIndex = rounds.length - 1;

  const renderSegment = (seg: ActivitySegmentOnly, roundThinkingItems: ThinkingItem[]) => {
    const open = isExpanded(seg);
    const isActive = seg.id === activeId;
    const useThinkingPipeline =
      activityPhaseStreaming &&
      roundThinkingItems.length > 0 &&
      rounds.length === 1;
    const latestThinkingId = roundThinkingItems[roundThinkingItems.length - 1]?.id ?? null;

    if (seg.kind === "thinking") {
      if (useThinkingPipeline && seg.id !== latestThinkingId) {
        return null;
      }
      if (useThinkingPipeline && seg.id === latestThinkingId) {
        return (
          <ThinkingPipeline
            key="thinking-pipeline"
            segments={roundThinkingItems}
            isStreaming={turnStreaming}
            freezeList={freezeToolsList}
            open={open}
            onToggle={() => onToggle(seg.id)}
            isActive={isActive && !freezeToolsList}
            onMergedCountChange={onMergedThinkingChange}
          />
        );
      }

      const showContent = open && (seg.content || seg.isStreaming);
      const hasPreview = Boolean(seg.content?.trim());
      return (
        <div
          key={seg.id}
          className={cn(
            "relative min-w-0",
            isActive && !freezeToolsList && "rounded-md bg-violet-500/[0.06] -mx-1 px-1"
          )}
        >
          <button
            type="button"
            onClick={() => onToggle(seg.id)}
            className="flex w-full items-center gap-1.5 py-1.5 text-left rounded-md pr-1 hover:bg-muted/40"
          >
            <ChevronRight
              className={cn(
                "h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-200 ease-out",
                open && "rotate-90"
              )}
            />
            <Brain className="h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-400" />
            <span className="text-xs text-muted-foreground">Thinking</span>
            {!hasPreview && !seg.isStreaming ? (
              <span className="truncate text-[11px] italic text-muted-foreground/70">
                (reasoning in answer below)
              </span>
            ) : null}
            <span className="ml-0.5 shrink-0">
              <StatusIcon status={seg.isStreaming ? "thinking" : "completed"} />
            </span>
          </button>
          {showContent ? (
            <div className="relative ml-5 mb-1.5 pl-3">
              <div
                className="pointer-events-none absolute left-0 top-1 bottom-1 w-px bg-border/50"
                aria-hidden
              />
              <p className="max-h-40 max-w-full overflow-y-auto text-xs italic leading-relaxed text-muted-foreground/90 whitespace-pre-wrap break-words">
                {seg.content}
              </p>
            </div>
          ) : null}
        </div>
      );
    }

    if (seg.kind === "tools") {
      const showTools = open;
      const running = seg.tools.some((t) => t.status === "running");
      const merged = mergedBySegment[seg.id] ?? 0;
      return (
        <div
          key={seg.id}
          className={cn(
            "relative min-w-0",
            isActive && !freezeToolsList && "rounded-md bg-muted/25 -mx-1 px-1"
          )}
        >
          <button
            type="button"
            onClick={() => onToggle(seg.id)}
            className="flex w-full items-center gap-1.5 py-1.5 text-left rounded-md pr-1 hover:bg-muted/40"
          >
            <ChevronRight
              className={cn(
                "h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-200 ease-out",
                showTools && "rotate-90"
              )}
            />
            <Wrench className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Tools ({seg.tools.length})
            </span>
            {merged > 0 && turnStreaming ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground animate-in fade-in duration-200">
                <Layers className="h-2.5 w-2.5 shrink-0 opacity-70" />
                +{merged} merged
              </span>
            ) : null}
            {running && !showTools ? (
              <Loader2 className="h-3 w-3 ml-0.5 animate-spin text-muted-foreground" />
            ) : null}
          </button>
          {showTools && (
            <ToolPipeline
              tools={seg.tools}
              isStreaming={turnStreaming}
              freezeList={freezeToolsList}
              onMergedCountChange={(count) =>
                setMergedBySegment((prev) => ({ ...prev, [seg.id]: count }))
              }
            />
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="relative py-1.5 pl-5">
      {!hideMainTimelineRail ? <TimelineRail /> : null}
      <div className="space-y-2">
        {rounds.map((roundSegs, roundIndex) => {
          const isLastRound = roundIndex === lastRoundIndex;
          const showCompact =
            activityPhaseStreaming && showRoundLabels && !isLastRound;

          if (showCompact) {
            return (
              <CompactActivityRound
                key={`round-compact-${roundIndex}`}
                roundIndex={roundIndex}
                segments={roundSegs}
              />
            );
          }

          const roundThinkingItems = thinkingItemsFromSegments(roundSegs);

          return (
            <div key={`round-${roundIndex}`} className="min-w-0 space-y-1">
              {showRoundLabels ? (
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/90">
                  Round {roundIndex + 1}
                </p>
              ) : null}
              {roundSegs.map((seg) => renderSegment(seg, roundThinkingItems))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface AssistantActivityViewProps {
  blocks: ChatBlock[];
  isStreaming?: boolean;
}

function isUserVisibleStatus(block: Extract<ChatBlock, { kind: "status" }>): boolean {
  if (block.label === "Agent turn") return false;
  if (block.detail?.startsWith("Round")) return false;
  return true;
}

function latestStatusDetail(blocks: ChatBlock[]): string | undefined {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    if (b.kind === "status" && isUserVisibleStatus(b)) {
      return b.detail ? `${b.label} · ${b.detail}` : b.label;
    }
  }
  return undefined;
}

function hasActiveStreamWork(segments: ActivitySegment[]): boolean {
  return segments.some(
    (s) =>
      s.kind === "tools" ||
      (s.kind === "thinking" && (s.content || s.isStreaming)) ||
      (s.kind === "response" && (s.content || s.isStreaming))
  );
}

function isResponseStreaming(
  segments: ActivitySegment[],
  turnStreaming?: boolean
): boolean {
  if (!turnStreaming) return false;
  return segments.some((s) => s.kind === "response" && s.isStreaming);
}

export function AssistantActivityView({ blocks, isStreaming }: AssistantActivityViewProps) {
  const segments = useMemo(
    () => parseSegments(reorderLateToolsBeforeResponse(blocks)),
    [blocks]
  );
  const displayItems = useMemo(() => buildDisplayItems(segments), [segments]);
  const displayStructureKey = useMemo(
    () =>
      displayItems
        .map((item) => {
          if (item.kind === "activity") {
            return `a:${item.id}:${item.segments.map((s) => s.id).join(",")}`;
          }
          if (item.kind === "response") {
            return `r:${item.segment.id}`;
          }
          return `e:${item.segment.id}`;
        })
        .join("|"),
    [displayItems]
  );
  const statusDetail = useMemo(() => latestStatusDetail(blocks), [blocks]);
  const showPreStream = Boolean(isStreaming && !hasActiveStreamWork(segments));

  const activeId = useMemo(
    () => getActiveSegmentId(segments, isStreaming),
    [segments, isStreaming]
  );

  const activeActivityGroupId = useMemo(
    () => getActiveActivityGroupId(displayItems, activeId, isStreaming),
    [displayItems, activeId, isStreaming]
  );

  const responseStreaming = useMemo(
    () => isResponseStreaming(segments, isStreaming),
    [segments, isStreaming]
  );

  const visibleActivityDuringResponse = useMemo(
    () =>
      responseStreaming ? activityIndexBeforeStreamingResponse(displayItems) : null,
    [displayItems, responseStreaming]
  );

  const activityPhaseStreaming = Boolean(isStreaming && !responseStreaming);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [activityOpen, setActivityOpen] = useState<Record<string, boolean>>({});
  const [mergedThinkingByActivity, setMergedThinkingByActivity] = useState<
    Record<string, number>
  >({});
  const activeGroupRef = useRef<HTMLDivElement | null>(null);
  const prevActiveGroupRef = useRef<string | null>(null);
  const enteredResponseStreamRef = useRef(false);
  const responseMinHeightsRef = useRef<Record<string, number>>({});
  const responseContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [, bumpResponseLayout] = useState(0);

  useEffect(() => {
    if (responseStreaming) {
      if (!enteredResponseStreamRef.current) {
        enteredResponseStreamRef.current = true;
        setActivityOpen((prev) => {
          const next = { ...prev };
          for (const item of displayItems) {
            if (item.kind !== "activity") continue;
            if (activityGroupHasFollowingResponse(displayItems, displayItems.indexOf(item))) {
              next[item.id] = false;
            }
          }
          return next;
        });
        setExpanded((prev) => {
          const next = { ...prev };
          for (const item of displayItems) {
            if (item.kind !== "activity") continue;
            for (const seg of item.segments) {
              next[seg.id] = false;
            }
          }
          return next;
        });
      }
      return;
    }
    enteredResponseStreamRef.current = false;
    responseMinHeightsRef.current = {};
  }, [responseStreaming, displayItems]);

  useLayoutEffect(() => {
    let grew = false;
    for (const item of displayItems) {
      if (item.kind !== "response" || !item.segment.isStreaming) continue;
      const el = responseContainerRefs.current[item.segment.id];
      if (!el) continue;
      const h = el.offsetHeight;
      const prev = responseMinHeightsRef.current[item.segment.id] ?? 0;
      if (h > prev) {
        responseMinHeightsRef.current[item.segment.id] = h;
        grew = true;
      }
    }
    if (grew) bumpResponseLayout((n) => n + 1);
  }, [displayItems, blocks]);

  useEffect(() => {
    if (responseStreaming) return;

    setExpanded((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const item of displayItems) {
        if (item.kind !== "activity") continue;
        const thinkingSegs = item.segments.filter(
          (s): s is Extract<ActivitySegmentOnly, { kind: "thinking" }> =>
            s.kind === "thinking"
        );
        const latestThinkingId = thinkingSegs[thinkingSegs.length - 1]?.id;
        for (const seg of item.segments) {
          if (seg.kind === "thinking") {
            if (activityPhaseStreaming && latestThinkingId === seg.id) {
              const wantOpen = Boolean(seg.isStreaming || seg.content);
              if (next[seg.id] !== wantOpen) {
                next[seg.id] = wantOpen;
                changed = true;
              }
            } else if (next[seg.id] === undefined) {
              next[seg.id] = false;
              changed = true;
            }
            continue;
          }
          const isActive = seg.id === activeId;
          if (isStreaming) {
            if (isActive && next[seg.id] !== true) {
              next[seg.id] = true;
              changed = true;
            } else if (!isActive && next[seg.id] !== false) {
              next[seg.id] = false;
              changed = true;
            }
          } else if (isActive && next[seg.id] !== true) {
            next[seg.id] = true;
            changed = true;
          } else if (!isActive && next[seg.id] === true) {
            next[seg.id] = false;
            changed = true;
          } else if (next[seg.id] === undefined) {
            next[seg.id] = false;
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });

    setActivityOpen((prev) => {
      const next = { ...prev };
      let changed = false;
      displayItems.forEach((item, index) => {
        if (item.kind !== "activity") return;
        if (
          !shouldUseBundledActivity(
            displayItems,
            index,
            activityPhaseStreaming,
            responseStreaming,
            null
          )
        ) {
          return;
        }

        const isActiveGroup = item.id === activeActivityGroupId;
        if (isActiveGroup) {
          if (next[item.id] !== true) {
            next[item.id] = true;
            changed = true;
          }
        } else if (next[item.id] !== false) {
          next[item.id] = false;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [
    activeId,
    activeActivityGroupId,
    activityPhaseStreaming,
    displayStructureKey,
    isStreaming,
    responseStreaming,
  ]);

  useEffect(() => {
    if (responseStreaming) return;
    if (!activeActivityGroupId || activeActivityGroupId === prevActiveGroupRef.current) {
      prevActiveGroupRef.current = activeActivityGroupId;
      return;
    }
    prevActiveGroupRef.current = activeActivityGroupId;
    activeGroupRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeActivityGroupId, responseStreaming]);

  const isExpanded = (seg: ActivitySegmentOnly) => {
    if (expanded[seg.id] !== undefined) return expanded[seg.id];
    if (seg.kind === "thinking") return false;
    if (responseStreaming) return false;
    if (seg.kind === "tools" && isStreaming && seg.id !== activeId) return false;
    if (seg.kind === "tools") return seg.id === activeId;
    return false;
  };

  const toggle = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="min-w-0 space-y-2 font-chat text-[13px]">
      {showPreStream ? (
        <PreStreamPlaceholder statusDetail={statusDetail} />
      ) : null}
      {!showPreStream &&
        displayItems.map((item, index) => {
        if (item.kind === "response") {
          const seg = item.segment;
          const minH = responseMinHeightsRef.current[seg.id];
          return (
            <div
              key={seg.id}
              ref={(el) => {
                responseContainerRefs.current[seg.id] = el;
              }}
              className="min-w-0"
              style={
                seg.isStreaming && minH
                  ? { minHeight: minH }
                  : undefined
              }
            >
              {(seg.content || seg.isStreaming) && (
                <ChatMarkdown
                  content={seg.content}
                  isStreaming={seg.isStreaming || (Boolean(isStreaming) && responseStreaming)}
                />
              )}
            </div>
          );
        }

        if (item.kind === "error") {
          const seg = item.segment;
          return (
            <div
              key={seg.id}
              className="flex items-start gap-2 text-sm text-destructive py-1"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{seg.message}</span>
            </div>
          );
        }

        if (
          responseStreaming &&
          visibleActivityDuringResponse !== null &&
          index !== visibleActivityDuringResponse
        ) {
          return null;
        }

        const useBundledActivity = shouldUseBundledActivity(
          displayItems,
          index,
          activityPhaseStreaming,
          responseStreaming,
          visibleActivityDuringResponse
        );
        const mergedEarlierThinking = mergedThinkingByActivity[item.id] ?? 0;
        const summary = activitySummary(item.segments);
        const activityStillRunning = item.segments.some(
          (s) =>
            (s.kind === "thinking" && s.isStreaming) ||
            (s.kind === "tools" && s.tools.some((t) => t.status === "running"))
        );
        const responseAfter = displayItems
          .slice(index + 1)
          .find((d): d is Extract<DisplayItem, { kind: "response" }> => d.kind === "response");
        const responseAfterStreaming =
          isStreaming || Boolean(responseAfter?.segment.isStreaming);
        const isActiveGroup = item.id === activeActivityGroupId;
        const groupOpen = responseStreaming
          ? (activityOpen[item.id] ?? false)
          : (activityOpen[item.id] ??
            (useBundledActivity && (isActiveGroup || activityPhaseStreaming)));

        if (useBundledActivity) {
          return (
            <div key={item.id} className="min-w-0 space-y-0">
              <Collapsible
                open={groupOpen}
                onOpenChange={(open) =>
                  setActivityOpen((prev) => ({ ...prev, [item.id]: open }))
                }
                className="min-w-0"
              >
                <div
                  ref={isActiveGroup ? activeGroupRef : undefined}
                  className={cn(
                    "min-w-0 overflow-hidden",
                    !responseStreaming && "transition-shadow duration-300",
                    isActiveGroup && activityStillRunning && !responseStreaming &&
                      "rounded-lg ring-1 ring-violet-500/20"
                  )}
                >
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg border border-border/60",
                        "bg-muted/25 px-3 py-2 text-left text-xs transition-colors duration-200",
                        "hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isActiveGroup && "border-violet-500/25 bg-violet-500/[0.07]"
                      )}
                    >
                      <ChevronRight
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ease-out",
                          groupOpen && "rotate-90"
                        )}
                      />
                      <Brain className="h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-400" />
                      <span className="font-medium text-foreground/90">Reasoning & tools</span>
                      {summary ? (
                        <span className="truncate text-muted-foreground">{summary}</span>
                      ) : null}
                      {mergedEarlierThinking > 0 && activityPhaseStreaming ? (
                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground animate-in fade-in duration-200">
                          <Layers className="h-2.5 w-2.5 shrink-0 opacity-70" />
                          +{mergedEarlierThinking} earlier
                        </span>
                      ) : null}
                      <span className="ml-auto flex shrink-0 items-center gap-1.5">
                        {activityStillRunning || responseAfterStreaming ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        )}
                      </span>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent
                    className={cn(
                      "overflow-hidden data-[state=closed]:hidden",
                      responseStreaming
                        ? "!transition-none"
                        : "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1 duration-200"
                    )}
                  >
                    {groupOpen ? (
                      <div className="mt-1.5 overflow-hidden rounded-md border border-border/50 bg-muted/15">
                        <ActivityTree
                          segments={item.segments}
                          activeId={activeId}
                          turnStreaming={isStreaming}
                          responseStreaming={responseStreaming}
                          freezeToolsList={responseStreaming}
                          onToggle={toggle}
                          isExpanded={isExpanded}
                          onMergedThinkingChange={(count) =>
                            setMergedThinkingByActivity((prev) => ({
                              ...prev,
                              [item.id]: count,
                            }))
                          }
                        />
                      </div>
                    ) : null}
                  </CollapsibleContent>
                </div>
              </Collapsible>
            </div>
          );
        }

        return (
          <div key={item.id} className="min-w-0 space-y-0">
            <div
              ref={isActiveGroup ? activeGroupRef : undefined}
              className={cn(
                "rounded-lg border border-violet-500/20 bg-violet-500/[0.05]",
                !responseStreaming && "transition-shadow duration-300",
                isActiveGroup && activityStillRunning && !responseStreaming &&
                  "ring-1 ring-violet-500/25"
              )}
            >
              <ActivityTree
                segments={item.segments}
                activeId={activeId}
                turnStreaming={isStreaming}
                responseStreaming={responseStreaming}
                freezeToolsList={responseStreaming}
                onToggle={toggle}
                isExpanded={isExpanded}
                onMergedThinkingChange={(count) =>
                  setMergedThinkingByActivity((prev) => ({
                    ...prev,
                    [item.id]: count,
                  }))
                }
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
