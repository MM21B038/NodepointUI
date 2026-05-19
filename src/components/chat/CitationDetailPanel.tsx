"use client";

import { useEffect } from "react";
import { CitationDetailContent } from "@/components/chat/CitationDetailContent";
import type { ParsedCitation } from "@/lib/chatCitations";
import { cn } from "@/lib/utils";

interface CitationDetailPanelProps {
  citation: ParsedCitation;
  onClose: () => void;
}

/** Side-panel shell — matches DialogContent card (border, radius, shadow, scroll). */
export function CitationDetailPanel({ citation, onClose }: CitationDetailPanelProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <aside
      className={cn(
        "flex h-full max-h-full min-h-0 w-full min-w-0 flex-col overflow-hidden",
        "rounded-lg border border-border bg-background shadow-sm"
      )}
      aria-label="Citation details"
    >
      <CitationDetailContent
        citation={citation}
        enabled
        onClose={onClose}
        showCloseButton
        variant="panel"
        idPrefix="citation-panel"
        className="min-h-0 flex-1"
      />
    </aside>
  );
}
