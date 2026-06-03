"use client";

import { useEffect, useRef, useState } from "react";
import { Brain, CheckCircle2, ChevronRight, Layers, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ThinkingItem = {
  id: string;
  content: string;
  isStreaming: boolean;
};

export const MAX_VISIBLE_THINKING = 1;

/** Keep in sync with ToolPipeline MERGE_MS / row durations. */
const MERGE_MS = 520;
const ENTER_STAGGER_MS = 45;

type SlotPhase = "enter" | "visible" | "mergeOut";

type PipelineSlot = {
  segment: ThinkingItem;
  phase: SlotPhase;
};

export interface ThinkingPipelineProps {
  segments: ThinkingItem[];
  isStreaming?: boolean;
  freezeList?: boolean;
  open?: boolean;
  onToggle?: () => void;
  isActive?: boolean;
  onMergedCountChange?: (count: number) => void;
}

function ThinkingStatusIcon({ isStreaming }: { isStreaming: boolean }) {
  if (isStreaming) {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
  }
  return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />;
}

function ThinkingRowContent({
  segment,
  open,
}: {
  segment: ThinkingItem;
  open: boolean;
}) {
  const showContent = open && (segment.content || segment.isStreaming);
  if (!showContent) return null;

  return (
    <div className="relative ml-5 mb-1.5 pl-3">
      <div
        className="pointer-events-none absolute left-0 top-1 bottom-1 w-px bg-border/50"
        aria-hidden
      />
      <p
        className={cn(
          "max-h-40 max-w-full overflow-y-auto text-xs italic leading-relaxed whitespace-pre-wrap break-words",
          segment.isStreaming
            ? "text-muted-foreground/90"
            : "text-muted-foreground/90"
        )}
      >
        {segment.content}
      </p>
    </div>
  );
}

export function ThinkingPipeline({
  segments,
  isStreaming,
  freezeList,
  open = false,
  onToggle,
  isActive,
  onMergedCountChange,
}: ThinkingPipelineProps) {
  const frozenVisibleRef = useRef<ThinkingItem[] | null>(null);
  const [slots, setSlots] = useState<PipelineSlot[]>([]);
  const [mergedCount, setMergedCount] = useState(0);
  const mergeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const usePipeline = Boolean(isStreaming && !freezeList);
  const latest = segments[segments.length - 1];

  const liveVisible = isStreaming ? segments.slice(-MAX_VISIBLE_THINKING) : segments;

  if (freezeList) {
    if (!frozenVisibleRef.current && liveVisible.length > 0) {
      frozenVisibleRef.current = liveVisible;
    }
  } else {
    frozenVisibleRef.current = null;
  }

  const idleVisible =
    freezeList && frozenVisibleRef.current?.length
      ? frozenVisibleRef.current
      : liveVisible;

  useEffect(() => {
    onMergedCountChange?.(usePipeline ? mergedCount : 0);
  }, [mergedCount, usePipeline, onMergedCountChange]);

  useEffect(() => {
    if (!usePipeline) {
      setSlots([]);
      setMergedCount(0);
      return;
    }

    const target = segments.slice(-MAX_VISIBLE_THINKING);
    const targetIds = new Set(target.map((s) => s.id));
    let mergeDelta = 0;

    setSlots((prev) => {
      let next: PipelineSlot[] = prev
        .filter((s) => s.phase === "mergeOut" || targetIds.has(s.segment.id))
        .map((s) => {
          const updated = target.find((t) => t.id === s.segment.id);
          if (!updated) return s;
          return { segment: updated, phase: s.phase };
        });

      for (const s of [...next]) {
        if (s.phase !== "mergeOut" && !targetIds.has(s.segment.id)) {
          next = next.map((row) =>
            row.segment.id === s.segment.id
              ? { ...row, phase: "mergeOut" as const }
              : row
          );
          mergeDelta += 1;
        }
      }

      for (const seg of target) {
        if (!next.some((s) => s.segment.id === seg.id)) {
          next.push({ segment: seg, phase: "enter" });
        }
      }

      let active = next.filter((s) => s.phase !== "mergeOut");
      while (active.length > MAX_VISIBLE_THINKING) {
        const oldest = active[0];
        next = next.map((row) =>
          row.segment.id === oldest.segment.id
            ? { ...row, phase: "mergeOut" as const }
            : row
        );
        active = active.slice(1);
        mergeDelta += 1;
      }

      return next;
    });

    if (mergeDelta > 0) {
      setMergedCount((c) => c + mergeDelta);
    }
  }, [segments, usePipeline]);

  useEffect(() => {
    if (!usePipeline) return;
    const entering = slots.some((s) => s.phase === "enter");
    if (!entering) return;
    const id = requestAnimationFrame(() => {
      setSlots((prev) =>
        prev.map((s) => (s.phase === "enter" ? { ...s, phase: "visible" as const } : s))
      );
    });
    return () => cancelAnimationFrame(id);
  }, [slots, usePipeline]);

  useEffect(() => {
    if (!usePipeline) return;
    if (!slots.some((s) => s.phase === "mergeOut")) return;

    if (mergeTimerRef.current) clearTimeout(mergeTimerRef.current);
    mergeTimerRef.current = setTimeout(() => {
      setSlots((prev) => prev.filter((s) => s.phase !== "mergeOut"));
      mergeTimerRef.current = null;
    }, MERGE_MS);

    return () => {
      if (mergeTimerRef.current) clearTimeout(mergeTimerRef.current);
    };
  }, [slots, usePipeline]);

  const displaySlots: PipelineSlot[] = usePipeline
    ? slots
    : idleVisible.map((segment) => ({ segment, phase: "visible" as const }));

  if (!usePipeline) {
    return null;
  }

  const visibleSlot = displaySlots.find(
    (s) => s.phase !== "mergeOut" && s.segment.id === latest?.id
  );

  return (
    <div className="relative min-w-0">
      <ul className="relative min-w-0 list-none overflow-visible p-0 m-0">
        {displaySlots.map((slot, index) => {
          const isCollapsed = slot.phase === "enter" || slot.phase === "mergeOut";
          const staggerDelay =
            slot.phase === "enter"
              ? 0
              : Math.max(0, displaySlots.length - 1 - index) * ENTER_STAGGER_MS;
          const isMergeOnly = slot.phase === "mergeOut";

          return (
            <li
              key={slot.segment.id}
              className={cn(
                "grid motion-reduce:transition-none",
                "transition-[grid-template-rows] ease-out",
                isCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
                slot.phase === "mergeOut" ? "duration-merge" : "duration-enter"
              )}
              style={
                slot.phase === "visible"
                  ? { transitionDelay: `${staggerDelay}ms` }
                  : undefined
              }
              aria-hidden={isMergeOnly}
            >
              <div
                className={cn(
                  "min-h-0",
                  isCollapsed && "overflow-hidden"
                )}
              >
                {isMergeOnly ? (
                  <div
                    className={cn(
                      "flex w-full items-center gap-1.5 py-1.5 text-left rounded-md pr-1 min-h-[1.75rem]",
                      "animate-tool-lane-merge motion-reduce:animate-none pointer-events-none"
                    )}
                  >
                    <Brain className="h-3.5 w-3.5 shrink-0 text-brand-chat/40 dark:text-brand-chat/40" />
                    <span className="text-xs text-muted-foreground/40">Thinking</span>
                  </div>
                ) : slot.segment.id === latest?.id ? (
                  <div
                    className={cn(
                      "relative min-w-0",
                      isActive && "rounded-md bg-brand-chat/[0.06] -mx-1 px-1",
                      slot.phase === "enter" &&
                        "animate-tool-lane-enter motion-reduce:animate-none"
                    )}
                  >
                    <button
                      type="button"
                      onClick={onToggle}
                      className="flex w-full items-center gap-1.5 py-1.5 text-left rounded-md pr-1 hover:bg-muted/40"
                    >
                      <ChevronRight
                        className={cn(
                          "h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-200 ease-out",
                          open && "rotate-90"
                        )}
                      />
                      <Brain className="h-3.5 w-3.5 shrink-0 text-brand-chat dark:text-brand-chat" />
                      <span className="text-xs text-muted-foreground">Thinking</span>
                      {mergedCount > 0 ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground animate-in fade-in duration-200">
                          <Layers className="h-2.5 w-2.5 shrink-0 opacity-70" />
                          +{mergedCount} earlier
                        </span>
                      ) : null}
                      <span className="ml-0.5 shrink-0">
                        <ThinkingStatusIcon isStreaming={slot.segment.isStreaming} />
                      </span>
                    </button>
                    {visibleSlot ? (
                      <ThinkingRowContent segment={slot.segment} open={open} />
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
