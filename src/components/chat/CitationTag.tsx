"use client";

import type { KeyboardEvent } from "react";
import type { CitationKind, ParsedCitation } from "@/lib/chatCitations";
import { CITATION_KIND_LABELS, extractCitationResourceId } from "@/lib/chatCitations";
import { useCitationModalOptional } from "@/components/chat/CitationModalContext";
import { cn } from "@/lib/utils";

const CITATION_STYLES: Record<
  CitationKind,
  { bg: string; border: string; text: string; badge: string }
> = {
  entity: {
    bg: "bg-violet-500/12",
    border: "border-violet-500/35",
    text: "text-violet-900 dark:text-violet-100",
    badge: "text-violet-600 dark:text-violet-300",
  },
  relation: {
    bg: "bg-emerald-500/12",
    border: "border-emerald-500/35",
    text: "text-emerald-900 dark:text-emerald-100",
    badge: "text-emerald-600 dark:text-emerald-300",
  },
  chunk: {
    bg: "bg-amber-500/12",
    border: "border-amber-500/35",
    text: "text-amber-950 dark:text-amber-50",
    badge: "text-amber-700 dark:text-amber-300",
  },
  doc: {
    bg: "bg-sky-500/12",
    border: "border-sky-500/35",
    text: "text-sky-900 dark:text-sky-100",
    badge: "text-sky-600 dark:text-sky-300",
  },
};

export interface CitationTagProps extends ParsedCitation {
  /** When false, renders a non-clickable tag (e.g. inside the detail modal). */
  interactive?: boolean;
}

export function CitationTag({ kind, label, href, interactive = true }: CitationTagProps) {
  const modal = useCitationModalOptional();
  const style = CITATION_STYLES[kind];
  const kindLabel = CITATION_KIND_LABELS[kind];
  const resourceId = extractCitationResourceId({ kind, label, href });
  const canOpen = interactive && !!modal && !!resourceId;

  const handleClick = () => {
    if (!canOpen || !modal) return;
    modal.openCitation({ kind, label, href });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!canOpen) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  const className = cn(
    "mx-0.5 inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 align-baseline text-xs font-medium leading-tight",
    style.bg,
    style.border,
    style.text,
    canOpen &&
      "cursor-pointer transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
  );

  const inner = (
    <>
      <span
        className={cn(
          "shrink-0 rounded px-1 py-px text-[9px] font-bold uppercase tracking-wider",
          style.badge,
          "bg-background/40"
        )}
      >
        {kindLabel}
      </span>
      {label ? <span className="min-w-0 truncate">{label}</span> : null}
    </>
  );

  if (canOpen) {
    return (
      <button
        type="button"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={className}
        title={label ? `${kindLabel}: ${label}` : `View ${kindLabel}`}
        aria-label={label ? `View ${kindLabel}: ${label}` : `View ${kindLabel}`}
      >
        {inner}
      </button>
    );
  }

  return (
    <span className={className} title={label ? `${kindLabel}: ${label}` : kindLabel}>
      {inner}
    </span>
  );
}
