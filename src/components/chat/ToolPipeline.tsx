"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToolItem = {
  id: string;
  name: string;
  status: "running" | "completed" | "failed";
};

export const MAX_VISIBLE_TOOLS = 3;

/** Keep in sync with Tailwind `duration-[…]` / animation durations on rows and rail. */
const ENTER_MS = 480;
const MERGE_MS = 520;
const RAIL_MS = 400;
const COMPLETE_MS = 400;
const ENTER_STAGGER_MS = 45;

type SlotPhase = "enter" | "visible" | "complete" | "mergeOut";

type PipelineSlot = {
  tool: ToolItem;
  phase: SlotPhase;
};

export interface ToolPipelineProps {
  tools: ToolItem[];
  isStreaming?: boolean;
  freezeList?: boolean;
  onMergedCountChange?: (count: number) => void;
}

function PipelineNode({
  status,
  phase,
}: {
  status: ToolItem["status"];
  phase: SlotPhase;
}) {
  return (
    <span
      className={cn(
        "block h-2.5 w-2.5 shrink-0 rounded-full border-2 border-background",
        status === "completed" && "bg-emerald-500 dark:bg-emerald-400",
        status === "failed" && "bg-red-500 dark:bg-red-400",
        status === "running" &&
          "bg-muted-foreground/50 ring-2 ring-muted/30 animate-timeline-glow",
        phase === "complete" && "animate-tool-node-complete motion-reduce:animate-none",
        phase !== "mergeOut" && "transition-colors duration-200"
      )}
      aria-hidden
    />
  );
}

function PipelineStatusIcon({
  status,
  phase,
}: {
  status: ToolItem["status"];
  phase: SlotPhase;
}) {
  if (phase === "complete" && status === "completed") {
    return (
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-150" />
    );
  }
  if (phase === "complete" && status === "failed") {
    return <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 animate-in fade-in duration-150" />;
  }
  if (status === "running") {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
  }
  if (status === "completed") {
    return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />;
  }
  return <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />;
}

export function ToolPipeline({
  tools,
  isStreaming,
  freezeList,
  onMergedCountChange,
}: ToolPipelineProps) {
  const [showAll, setShowAll] = useState(false);
  const frozenVisibleRef = useRef<ToolItem[] | null>(null);
  const [slots, setSlots] = useState<PipelineSlot[]>([]);
  const [mergedCount, setMergedCount] = useState(0);
  const prevStatusRef = useRef<Map<string, ToolItem["status"]>>(new Map());
  const mergeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const hasMore = tools.length > MAX_VISIBLE_TOOLS;
  const usePipeline = Boolean(isStreaming && !freezeList);
  const anyRunning = tools.some((t) => t.status === "running");

  const liveVisible = isStreaming
    ? tools.slice(-MAX_VISIBLE_TOOLS)
    : showAll
      ? tools
      : tools.slice(0, MAX_VISIBLE_TOOLS);

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
      prevStatusRef.current = new Map();
      return;
    }

    const target = tools.slice(-MAX_VISIBLE_TOOLS);
    const targetIds = new Set(target.map((t) => t.id));
    let mergeDelta = 0;

    setSlots((prev) => {
      let next: PipelineSlot[] = prev
        .filter((s) => s.phase === "mergeOut" || targetIds.has(s.tool.id))
        .map((s) => {
          const updated = target.find((t) => t.id === s.tool.id);
          if (!updated) return s;
          const prevStatus = prevStatusRef.current.get(s.tool.id);
          let phase: SlotPhase = s.phase;
          if (
            s.phase !== "mergeOut" &&
            s.phase !== "enter" &&
            prevStatus === "running" &&
            updated.status !== "running" &&
            updated.status !== prevStatus
          ) {
            phase = "complete";
          }
          prevStatusRef.current.set(updated.id, updated.status);
          return { tool: updated, phase };
        });

      for (const s of [...next]) {
        if (s.phase !== "mergeOut" && !targetIds.has(s.tool.id)) {
          next = next.map((row) =>
            row.tool.id === s.tool.id ? { ...row, phase: "mergeOut" as const } : row
          );
          mergeDelta += 1;
        }
      }

      for (const tool of target) {
        if (!next.some((s) => s.tool.id === tool.id)) {
          prevStatusRef.current.set(tool.id, tool.status);
          next.push({ tool, phase: "enter" });
        }
      }

      let active = next.filter((s) => s.phase !== "mergeOut");
      while (active.length > MAX_VISIBLE_TOOLS) {
        const oldest = active[0];
        next = next.map((row) =>
          row.tool.id === oldest.tool.id ? { ...row, phase: "mergeOut" as const } : row
        );
        active = active.slice(1);
        mergeDelta += 1;
      }

      return next;
    });

    if (mergeDelta > 0) {
      setMergedCount((c) => c + mergeDelta);
    }

    for (const t of tools) {
      if (!prevStatusRef.current.has(t.id)) {
        prevStatusRef.current.set(t.id, t.status);
      }
    }
  }, [tools, usePipeline]);

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

    for (const slot of slots) {
      if (slot.phase !== "complete") continue;
      if (completeTimersRef.current.has(slot.tool.id)) continue;

      const timer = setTimeout(() => {
        setSlots((prev) =>
          prev.map((s) =>
            s.tool.id === slot.tool.id && s.phase === "complete"
              ? { ...s, phase: "visible" as const }
              : s
          )
        );
        completeTimersRef.current.delete(slot.tool.id);
      }, COMPLETE_MS);

      completeTimersRef.current.set(slot.tool.id, timer);
    }
  }, [slots, usePipeline]);

  useEffect(() => {
    return () => {
      for (const t of completeTimersRef.current.values()) clearTimeout(t);
      completeTimersRef.current.clear();
    };
  }, []);

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
    : idleVisible.map((tool) => ({ tool, phase: "visible" as const }));

  const hiddenCount = tools.length - MAX_VISIBLE_TOOLS;

  return (
    <div className="relative ml-1 mt-0.5 pl-4 motion-reduce:transition-none">
      {displaySlots.length > 0 ? (
        <div
          className={cn(
            "pointer-events-none absolute left-[3px] top-2 w-px origin-top overflow-hidden bg-border/70",
            "transition-[transform,height] duration-[400ms] ease-out motion-reduce:transition-none"
          )}
          style={{ height: "calc(100% - 0.5rem)" }}
          aria-hidden
        >
          {anyRunning && usePipeline ? (
            <div className="absolute inset-0 w-full bg-gradient-to-b from-transparent via-violet-500/50 to-transparent animate-tool-rail-flow motion-reduce:animate-none" />
          ) : null}
        </div>
      ) : null}
      <ul
        className={cn(
          "relative min-w-0 list-none overflow-visible p-0 m-0",
          "transition-[height] duration-[400ms] ease-out motion-reduce:transition-none"
        )}
      >
        {displaySlots.map((slot, index) => {
          const isCollapsed = slot.phase === "enter" || slot.phase === "mergeOut";
          const staggerDelay =
            slot.phase === "enter"
              ? 0
              : Math.max(0, displaySlots.length - 1 - index) * ENTER_STAGGER_MS;

          return (
            <li
              key={slot.tool.id}
              className={cn(
                "grid motion-reduce:transition-none",
                "transition-[grid-template-rows] ease-out",
                isCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
                slot.phase === "mergeOut" ? "duration-[520ms]" : "duration-[480ms]"
              )}
              style={
                usePipeline && slot.phase === "visible"
                  ? { transitionDelay: `${staggerDelay}ms` }
                  : undefined
              }
            >
              <div
                className={cn(
                  "min-h-0",
                  (slot.phase === "enter" || slot.phase === "mergeOut") && "overflow-hidden"
                )}
              >
                <div
                  className={cn(
                    "relative flex min-w-0 items-center gap-2 pr-1 -ml-1 rounded-sm",
                    "min-h-[1.75rem]",
                    slot.phase === "enter" &&
                      "animate-tool-lane-enter motion-reduce:animate-none",
                    slot.phase !== "mergeOut" && "hover:bg-muted/30"
                  )}
                >
                  <span className="flex w-4 shrink-0 items-center justify-center overflow-visible">
                    <PipelineNode status={slot.tool.status} phase={slot.phase} />
                  </span>
                  <div
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-2 overflow-hidden",
                      slot.phase === "mergeOut" &&
                        "animate-tool-lane-merge motion-reduce:animate-none pointer-events-none"
                    )}
                  >
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-xs font-mono transition-colors duration-200",
                        slot.tool.status === "completed" &&
                          "text-emerald-800 dark:text-emerald-200",
                        slot.tool.status === "failed" && "text-red-700 dark:text-red-300",
                        slot.tool.status === "running" && "text-muted-foreground"
                      )}
                    >
                      {slot.tool.name}
                    </span>
                    <span className="shrink-0 pl-1">
                      <PipelineStatusIcon
                        status={slot.tool.status}
                        phase={slot.phase}
                      />
                    </span>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {hasMore && !isStreaming && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-0.5 pl-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {showAll ? "Show less" : `Show ${hiddenCount} more`}
        </button>
      )}
    </div>
  );
}
