"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CitationDetailPanel } from "@/components/chat/CitationDetailPanel";
import {
  useCitationLayoutReporter,
  useCitationModal,
} from "@/components/chat/CitationModalContext";
import {
  useCitationLayoutMode,
  PANEL_GUTTER_PX,
  PANEL_TRANSITION_EASING,
  PANEL_TRANSITION_MS,
} from "@/hooks/useCitationLayoutMode";
import { useCitationPanelTransition } from "@/hooks/useCitationPanelTransition";
import type { ParsedCitation } from "@/lib/chatCitations";
import { cn } from "@/lib/utils";

const ROW_TRANSITION: CSSProperties = {
  transitionProperty: "width, gap",
  transitionDuration: `${PANEL_TRANSITION_MS}ms`,
  transitionTimingFunction: PANEL_TRANSITION_EASING,
};

const PANEL_SLOT_TRANSITION: CSSProperties = {
  transitionProperty: "width, opacity",
  transitionDuration: `${PANEL_TRANSITION_MS}ms`,
  transitionTimingFunction: PANEL_TRANSITION_EASING,
};

const PANEL_SLIDE_TRANSITION: CSSProperties = {
  transitionProperty: "transform, opacity",
  transitionDuration: `${PANEL_TRANSITION_MS}ms`,
  transitionTimingFunction: PANEL_TRANSITION_EASING,
};

/** Split view: chat column (header + messages + composer) and citation panel. */
export function CitationSplitLayout({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const { layout, panelWidth, chatColumnWidth, splitGroupWidth, containerWidth } =
    useCitationLayoutMode(containerRef);
  const { isOpen, citation, closeCitation } = useCitationModal();

  useCitationLayoutReporter(layout);

  const panelOpen = isOpen && layout === "panel" && !!citation;
  const supportsPanel = layout === "panel";
  const { expanded, visible } = useCitationPanelTransition(panelOpen, rowRef);

  const [displayCitation, setDisplayCitation] = useState<ParsedCitation | null>(citation);
  useEffect(() => {
    if (citation) setDisplayCitation(citation);
  }, [citation]);

  const showPanelSlot = supportsPanel && visible && displayCitation;
  const pixelRow = supportsPanel && containerWidth > 0;

  const groupWidth = pixelRow
    ? expanded
      ? splitGroupWidth
      : containerWidth
    : undefined;

  const chatWidth = pixelRow
    ? expanded
      ? chatColumnWidth
      : containerWidth
    : undefined;

  const slotWidth = pixelRow && showPanelSlot ? (expanded ? panelWidth : 0) : 0;
  const slotGap = pixelRow && showPanelSlot ? (expanded ? PANEL_GUTTER_PX : 0) : 0;

  return (
    <div
      ref={containerRef}
      className={cn("flex h-full min-h-0 w-full flex-1 overflow-hidden", className)}
    >
      <div
        ref={rowRef}
        className={cn(
          "flex h-full min-h-0 max-w-full motion-reduce:!transition-none",
          pixelRow ? "h-full w-full shrink-0" : "min-w-0 w-full flex-1"
        )}
        style={{
          ...ROW_TRANSITION,
          width: groupWidth,
          gap: slotGap,
        }}
      >
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-col overflow-hidden motion-reduce:!transition-none",
            pixelRow ? "h-full shrink-0" : "min-w-0 flex-1"
          )}
          style={{
            ...ROW_TRANSITION,
            width: chatWidth,
            flexBasis: chatWidth,
          }}
        >
          {children}
        </div>
        <div
          className={cn(
            "flex h-full min-h-0 shrink-0 flex-col justify-stretch overflow-hidden motion-reduce:!transition-none",
            showPanelSlot && expanded && "shrink-0 pt-3 pb-3 pr-2"
          )}
          style={{
            ...PANEL_SLOT_TRANSITION,
            width: slotWidth,
            opacity: expanded ? 1 : 0,
          }}
          aria-hidden={!showPanelSlot}
        >
          {showPanelSlot && displayCitation && (
            <div
              className="h-full max-h-full min-h-0 motion-reduce:!transition-none"
              style={{
                width: panelWidth,
                ...PANEL_SLIDE_TRANSITION,
                transform: expanded ? "translateX(0)" : "translateX(100%)",
                opacity: expanded ? 1 : 0,
              }}
            >
              <CitationDetailPanel citation={displayCitation} onClose={closeCitation} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
