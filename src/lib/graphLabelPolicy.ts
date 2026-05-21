import type { GraphLabelMode } from "@/lib/graphSimulationConfig";

export type GraphLabelProfile = "detailed" | "default" | "compact";

/** Matches InteractiveGraphVisualization scaleExtent minimum. */
export const ZOOM_LABEL_MIN_K = 0.08;
export const ZOOM_HIDE_ALL_K = 0.35;
export const ZOOM_NEIGHBORHOOD_K = 0.85;
export const ZOOM_FULL_K = 1.15;
export const ZOOM_WORKSPACE_SUBLABEL_K = 1.2;

const LABEL_MIN_FONT_PX = 10;
const LABEL_BASE_FONT_PX = 11;
const LABEL_MAX_FONT_PX = 14;
const WORKSPACE_SUBLABEL_FONT_PX = 9;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Screen-space label size: readable when zoomed in, not huge when zoomed out. */
export function labelFontSizeScreenPx(zoomK: number): number {
  const k = Math.max(ZOOM_LABEL_MIN_K, zoomK);
  return clamp(
    Math.round(LABEL_BASE_FONT_PX * Math.sqrt(k)),
    LABEL_MIN_FONT_PX,
    LABEL_MAX_FONT_PX
  );
}

export function workspaceSublabelFontSizeScreenPx(zoomK: number): number {
  return Math.max(8, Math.round(WORKSPACE_SUBLABEL_FONT_PX * Math.sqrt(Math.max(1, zoomK))));
}

export function zoomPercentForHint(zoomK: number): number {
  return Math.round(Math.max(ZOOM_LABEL_MIN_K, zoomK) * 100);
}

function labelModeAllows(
  labelMode: GraphLabelMode,
  nodeId: string,
  selectedId: string | null,
  hoveredId: string | null,
  selectionEmphasisIds: Set<string> | null,
  hoverEmphasisIds: Set<string> | null
): boolean {
  switch (labelMode) {
    case "always":
      return true;
    case "onSelect":
      if (!selectedId || !selectionEmphasisIds) return false;
      return selectionEmphasisIds.has(nodeId);
    case "onHover":
      if (!hoveredId || !hoverEmphasisIds) return false;
      return hoverEmphasisIds.has(nodeId);
    default:
      return true;
  }
}

export function shouldShowNodeLabel(args: {
  zoomK: number;
  labelMode: GraphLabelMode;
  profile: GraphLabelProfile;
  nodeId: string;
  nodeDegree: number;
  selectedId: string | null;
  hoveredId: string | null;
  emphasisIds: Set<string> | null;
  selectionEmphasisIds: Set<string> | null;
  hoverEmphasisIds: Set<string> | null;
}): boolean {
  const {
    zoomK,
    labelMode,
    profile,
    nodeId,
    nodeDegree,
    selectedId,
    hoveredId,
    emphasisIds,
    selectionEmphasisIds,
    hoverEmphasisIds,
  } = args;

  const k = Math.max(ZOOM_LABEL_MIN_K, zoomK);

  if (nodeId === selectedId || nodeId === hoveredId) {
    return true;
  }

  if (k < ZOOM_HIDE_ALL_K) {
    return false;
  }

  if (k < ZOOM_NEIGHBORHOOD_K) {
    return emphasisIds != null && emphasisIds.has(nodeId);
  }

  if (profile === "compact" && k < ZOOM_FULL_K) {
    const inEmphasis = emphasisIds?.has(nodeId) ?? false;
    if (inEmphasis) return true;
    return nodeDegree >= 2 && labelModeAllows(
      labelMode,
      nodeId,
      selectedId,
      hoveredId,
      selectionEmphasisIds,
      hoverEmphasisIds
    );
  }

  return labelModeAllows(
    labelMode,
    nodeId,
    selectedId,
    hoveredId,
    selectionEmphasisIds,
    hoverEmphasisIds
  );
}

export function shouldShowWorkspaceSublabel(args: {
  zoomK: number;
  profile: GraphLabelProfile;
  workspaceName: string | null;
  nodeId: string;
  selectedId: string | null;
  hoveredId: string | null;
  emphasisIds: Set<string> | null;
}): boolean {
  if (!args.workspaceName?.trim()) return false;
  if (args.zoomK < ZOOM_WORKSPACE_SUBLABEL_K) return false;
  if (args.profile === "compact") {
    return (
      args.nodeId === args.selectedId ||
      args.nodeId === args.hoveredId ||
      (args.emphasisIds?.has(args.nodeId) ?? false)
    );
  }
  return true;
}

export function graphLabelHintMessage(args: {
  zoomK: number;
  profile: GraphLabelProfile;
  showLabels: boolean;
  nodeCount: number;
}): string | null {
  if (!args.showLabels || args.nodeCount === 0) return null;
  const k = Math.max(ZOOM_LABEL_MIN_K, args.zoomK);
  const pct = zoomPercentForHint(k);

  if (k < ZOOM_NEIGHBORHOOD_K) {
    return `Zoom in to see more labels (${pct}%)`;
  }
  if (args.profile === "compact" && k >= ZOOM_FULL_K) {
    return "Showing labels for selected area";
  }
  return null;
}
