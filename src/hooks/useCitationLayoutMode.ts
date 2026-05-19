import * as React from "react";

/** Tailwind max-w-6xl — matches Stream CHAT_THREAD_MAX_CLASS */
export const CHAT_THREAD_MAX_PX = 1152;

export const CITATION_PANEL_MAX_PX = 420;

export const CITATION_PANEL_MIN_PX = 300;

/** Gap between chat column and citation panel (px) */
export const PANEL_GUTTER_PX = 12;

export const PANEL_TRANSITION_MS = 480;

export const PANEL_TRANSITION_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

export type CitationLayoutMode = "modal" | "panel";

/** Fixed citation panel width; only shrinks when the viewport is tight. */
export function computeCitationPanelWidth(containerWidth: number): number {
  const available = containerWidth - CHAT_THREAD_MAX_PX - PANEL_GUTTER_PX;
  if (available >= CITATION_PANEL_MAX_PX) return CITATION_PANEL_MAX_PX;
  if (available >= CITATION_PANEL_MIN_PX) return available;
  return CITATION_PANEL_MIN_PX;
}

export function canFitCitationPanel(containerWidth: number): boolean {
  if (containerWidth <= 0) return false;
  const panelWidth = computeCitationPanelWidth(containerWidth);
  return containerWidth >= CHAT_THREAD_MAX_PX + panelWidth + PANEL_GUTTER_PX;
}

export interface CitationSplitMetrics {
  panelWidth: number;
  chatColumnWidth: number;
  splitGroupWidth: number;
}

/** Widths for a shrink-wrapped chat + gutter + panel row. */
export function computeCitationSplitMetrics(containerWidth: number): CitationSplitMetrics {
  const panelWidth = computeCitationPanelWidth(containerWidth);
  const chatColumnWidth = Math.min(
    CHAT_THREAD_MAX_PX,
    Math.max(0, containerWidth - panelWidth - PANEL_GUTTER_PX)
  );
  return {
    panelWidth,
    chatColumnWidth,
    splitGroupWidth: chatColumnWidth + PANEL_GUTTER_PX + panelWidth,
  };
}

export interface CitationLayoutState extends CitationSplitMetrics {
  layout: CitationLayoutMode;
  containerWidth: number;
}

const DEFAULT_LAYOUT: CitationLayoutState = {
  layout: "modal",
  panelWidth: CITATION_PANEL_MAX_PX,
  chatColumnWidth: CHAT_THREAD_MAX_PX,
  splitGroupWidth: CHAT_THREAD_MAX_PX + PANEL_GUTTER_PX + CITATION_PANEL_MAX_PX,
  containerWidth: 0,
};

export function useCitationLayoutMode(
  containerRef: React.RefObject<HTMLDivElement | null>
): CitationLayoutState {
  const [state, setState] = React.useState<CitationLayoutState>(DEFAULT_LAYOUT);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const containerWidth = el.getBoundingClientRect().width;
      const metrics = computeCitationSplitMetrics(containerWidth);
      setState({
        containerWidth,
        ...metrics,
        layout: canFitCitationPanel(containerWidth) ? "panel" : "modal",
      });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  return state;
}
