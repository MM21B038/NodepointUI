"use client";

import type { KeyboardEvent } from "react";
import type { CitationKind, ParsedCitation } from "@/lib/chatCitations";
import {
  CITATION_KIND_LABELS,
  extractCitationResourceId,
  getCitationDisplayLabel,
} from "@/lib/chatCitations";
import { useCitationModalOptional } from "@/components/chat/CitationModalContext";
import { brand } from "@/lib/brandColors";
import { cn } from "@/lib/utils";

const CITATION_STYLES: Record<
  CitationKind,
  { bg: string; border: string; text: string; badge: string }
> = {
  entity: {
    bg: brand.group.bg,
    border: brand.group.border,
    text: "text-foreground",
    badge: brand.group.text,
  },
  relation: {
    bg: brand.success.bg,
    border: brand.success.border,
    text: "text-foreground",
    badge: brand.success.text,
  },
  chunk: {
    bg: brand.info.bg,
    border: brand.info.border,
    text: "text-foreground",
    badge: brand.info.text,
  },
  doc: {
    bg: brand.workspace.bg,
    border: brand.workspace.border,
    text: "text-foreground",
    badge: brand.workspace.text,
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
  const displayLabel = getCitationDisplayLabel({ kind, label, href });
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
      {displayLabel ? <span className="min-w-0 truncate">{displayLabel}</span> : null}
    </>
  );

  if (canOpen) {
    return (
      <button
        type="button"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={className}
        title={displayLabel ? `${kindLabel}: ${displayLabel}` : `View ${kindLabel}`}
        aria-label={displayLabel ? `View ${kindLabel}: ${displayLabel}` : `View ${kindLabel}`}
      >
        {inner}
      </button>
    );
  }

  return (
    <span className={className} title={displayLabel ? `${kindLabel}: ${displayLabel}` : kindLabel}>
      {inner}
    </span>
  );
}
