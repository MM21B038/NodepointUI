"use client";
// @refresh reset

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { PrajnaStreamGlyph } from "@/components/chat/PrajnaStreamGlyph";

/** Sparkles + ping for connecting / analysing (pre-token only). */
function PreStreamSparklesMark() {
  return (
    <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-chat/30 bg-brand-chat/10">
      <Sparkles className="h-4 w-4 text-brand-chat dark:text-brand-chat" />
      <span
        className="absolute inset-0 rounded-full bg-brand-chat/20 animate-ping"
        style={{ animationDuration: "2.4s" }}
        aria-hidden
      />
    </div>
  );
}

const DEFAULT_PHASES = [
  "Connecting to assistant…",
  "Reviewing your question…",
  "Searching the knowledge graph…",
  "Preparing a reply…",
] as const;

export function TypingDots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground/55 animate-bounce-dot"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}

/** Morphing glyph for the live edge of streaming (response, thinking, tools). */
export function StreamingActivityMark({ className }: { className?: string }) {
  return <PrajnaStreamGlyph className={className} size="sm" />;
}

/** Consistent inline placement on the active “next line” of a stream. */
export function LiveEdgeMark({ className }: { className?: string }) {
  return (
    <StreamingActivityMark
      className={cn(
        "ml-0.5 inline-block align-text-bottom leading-none shrink-0 overflow-visible",
        className
      )}
    />
  );
}

/** Block row: optional text + live mark on its own visual line. */
export function LiveEdgeLine({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[1.125rem] flex-wrap items-end gap-x-1 gap-y-0.5 overflow-visible",
        className
      )}
      aria-hidden
    >
      {children}
      <LiveEdgeMark />
    </div>
  );
}

export function StreamingCursor({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-px rounded-sm bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.45)] animate-cursor-blink",
        className
      )}
      aria-hidden
    />
  );
}

interface PreStreamPlaceholderProps {
  statusDetail?: string;
  className?: string;
}

export function PreStreamPlaceholder({ statusDetail, className }: PreStreamPlaceholderProps) {
  const phases = useMemo(
    () => (statusDetail ? [statusDetail, ...DEFAULT_PHASES.slice(1)] : [...DEFAULT_PHASES]),
    [statusDetail]
  );
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    setPhaseIndex(0);
  }, [statusDetail]);

  useEffect(() => {
    if (phases.length <= 1) return;
    const timer = window.setInterval(
      () => setPhaseIndex((i) => (i + 1) % phases.length),
      2800
    );
    return () => window.clearInterval(timer);
  }, [phases, statusDetail]);

  return (
    <div
      className={cn("animate-in fade-in-0 duration-300 space-y-3 py-0.5", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-start gap-3">
        <PreStreamSparklesMark />
        <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
          <p
            key={phaseIndex}
            className="text-sm font-medium text-foreground/90 animate-in fade-in-0 slide-in-from-left-1 duration-500"
          >
            {phases[phaseIndex]}
          </p>
          <TypingDots />
        </div>
      </div>

      <div className="relative h-1 overflow-hidden rounded-full bg-muted/50">
        <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-brand-chat/35 animate-pulse" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-chat/25 to-transparent bg-[length:200%_100%] animate-shimmer" />
      </div>

      <div className="space-y-2" aria-hidden>
        {[0.92, 0.78, 0.52].map((width, i) => (
          <div
            key={i}
            className="h-3 overflow-hidden rounded-md bg-muted/45"
            style={{ width: `${width * 100}%` }}
          >
            <div
              className="h-full w-full bg-gradient-to-r from-muted/20 via-muted-foreground/12 to-muted/20 bg-[length:200%_100%] animate-shimmer"
              style={{ animationDelay: `${i * 180}ms` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface StreamingContentShellProps {
  isStreaming?: boolean;
  hasContent: boolean;
  children: ReactNode;
  className?: string;
}

export function StreamingContentShell({ children, className }: StreamingContentShellProps) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <div>{children}</div>
    </div>
  );
}
