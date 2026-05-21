"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as d3 from "d3";
import { GraphNode, GraphEdge } from "@/database/workspaceStorage";
import { cn } from "@/lib/utils";
import { GraphSimulationControls } from "@/components/GraphSimulationControls";
import {
  DEFAULT_GRAPH_SIMULATION_CONFIG,
  getStoredGraphConfig,
  mergeConfigPatch,
  setStoredGraphConfig,
  type GraphSimulationConfig,
} from "@/lib/graphSimulationConfig";
import {
  labelFontSizeScreenPx,
  shouldShowNodeLabel,
  shouldShowWorkspaceSublabel,
  workspaceSublabelFontSizeScreenPx,
  type GraphLabelProfile,
} from "@/lib/graphLabelPolicy";

const colorScale = d3.scaleOrdinal(d3.schemeSet3);

const LABEL_TRUNCATE_LEN = 28;

const getNodeD3Colors = (type: string, muted: boolean) => {
  const fill = colorScale(type);
  const baseStroke = d3.color(fill)?.darker(1.8).toString() || "#000000";
  if (!muted) {
    return { fill, stroke: baseStroke };
  }
  const fillColor = d3.color(fill);
  const strokeColor = d3.color(baseStroke);
  return {
    fill: fillColor?.copy({ opacity: 0.55 }).toString() ?? fill,
    stroke: strokeColor?.copy({ opacity: 0.45 }).toString() ?? baseStroke,
  };
};

const getEdgeD3Color = (muted: boolean) => {
  return muted ? "hsl(var(--muted-foreground) / 0.35)" : "hsl(var(--muted-foreground))";
};

type NodeFocusTier = "none" | "focus" | "neighborhood" | "faded";

function truncateLabel(label: string, max = LABEL_TRUNCATE_LEN): string {
  if (label.length <= max) return label;
  return `${label.slice(0, max - 1)}…`;
}

interface InteractiveGraphVisualizationProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onSelect: (node: GraphNode | null) => void;
  selectedItem: GraphNode | null;
  onGraphBackgroundClick?: () => void;
  showControls?: boolean;
  bottomLeftOverlay?: React.ReactNode;
  graphControlsOpen?: boolean;
  onGraphControlsOpenChange?: (open: boolean) => void;
  /** Changes on API reload / scope switch — triggers fit-to-view, not client-side filters */
  viewResetKey?: string;
  /** Client-side filter: hide nodes not in this set. `null` = show all loaded nodes. */
  visibleNodeIds?: Set<string> | null;
  /** BFS hop radius for selection/hover emphasis (default 1). */
  focusDepth?: number;
  /** Use lighter defaults (hover labels, faster decay) for medium/large graphs. */
  largeGraphMode?: boolean;
  /** Scope/density preset for zoom LOD and label defaults. */
  labelProfile?: GraphLabelProfile;
  /** When true, show workspace name under entity label at sufficient zoom (group graphs). */
  showWorkspaceSublabel?: boolean;
  /** Fired when zoom scale changes (for label hints). */
  onZoomChange?: (zoomK: number) => void;
}

type D3Node = GraphNode & d3.SimulationNodeDatum & { degree?: number };
type D3Edge = GraphEdge & { source: D3Node | string; target: D3Node | string };

function getNodeIdsWithinDepth(
  nodeId: string,
  maxDepth: number,
  edges: D3Edge[]
): Set<string> {
  const depth = Math.max(0, maxDepth);
  const result = new Set<string>([nodeId]);
  let frontier = new Set<string>([nodeId]);

  for (let hop = 0; hop < depth; hop++) {
    const next = new Set<string>();
    for (const id of frontier) {
      for (const edge of edges) {
        const sid = (edge.source as D3Node).id ?? String(edge.source);
        const tid = (edge.target as D3Node).id ?? String(edge.target);
        if (sid === id && !result.has(tid)) {
          result.add(tid);
          next.add(tid);
        } else if (tid === id && !result.has(sid)) {
          result.add(sid);
          next.add(sid);
        }
      }
    }
    frontier = next;
    if (frontier.size === 0) break;
  }

  return result;
}

const cleanNodeData = (d: D3Node): GraphNode => ({
  id: d.id,
  label: d.label,
  type: d.type,
  source: d.source,
  attributes: d.attributes,
});

function applySimulationForces(
  simulation: d3.Simulation<D3Node, D3Edge>,
  edges: D3Edge[],
  config: GraphSimulationConfig,
  width: number,
  height: number
) {
  const cx = width / 2;
  const cy = height / 2;
  simulation
    .velocityDecay(config.velocityDecay)
    .force(
      "link",
      d3
        .forceLink<D3Node, D3Edge>(edges)
        .id((d) => d.id)
        .distance(config.linkDistance)
        .strength(config.linkStrength)
    )
    .force("charge", d3.forceManyBody().strength(config.chargeStrength))
    .force("center", d3.forceCenter(cx, cy).strength(config.centerStrength))
    .force("x", d3.forceX(cx).strength(config.xStrength))
    .force("y", d3.forceY(cy).strength(config.yStrength))
    .force(
      "collide",
      d3.forceCollide<D3Node>(config.collisionRadius + config.nodeRadius)
    );
}

const InteractiveGraphVisualization: React.FC<InteractiveGraphVisualizationProps> = ({
  nodes: initialNodes,
  edges: initialEdges,
  onSelect,
  selectedItem,
  onGraphBackgroundClick = () => {},
  showControls = true,
  bottomLeftOverlay,
  graphControlsOpen,
  onGraphControlsOpenChange,
  viewResetKey,
  visibleNodeIds = null,
  focusDepth = 1,
  largeGraphMode = false,
  labelProfile = "default",
  showWorkspaceSublabel = false,
  onZoomChange,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(400);
  const [config, setConfig] = useState<GraphSimulationConfig>(() => {
    const stored = getStoredGraphConfig();
    if (labelProfile === "detailed") {
      return mergeConfigPatch(stored, {
        labelMode: "always",
        showLabels: true,
      });
    }
    if (largeGraphMode || labelProfile === "compact") {
      return mergeConfigPatch(stored, {
        labelMode: "onHover",
        showLabels: true,
        velocityDecay: 0.55,
        chargeStrength: -220,
      });
    }
    return stored;
  });

  const configRef = useRef(config);
  configRef.current = config;

  const hoveredNodeIdRef = useRef<string | null>(null);
  const shouldAutoFitRef = useRef(true);
  const savedTransformRef = useRef<d3.ZoomTransform | null>(null);
  const updateHighlightingRef = useRef<() => void>(() => {});
  const fitViewRef = useRef<() => void>(() => {});
  const onSelectRef = useRef(onSelect);
  const onGraphBackgroundClickRef = useRef(onGraphBackgroundClick);
  const onZoomChangeRef = useRef(onZoomChange);
  const labelProfileRef = useRef(labelProfile);
  const showWorkspaceSublabelRef = useRef(showWorkspaceSublabel);
  onSelectRef.current = onSelect;
  onGraphBackgroundClickRef.current = onGraphBackgroundClick;
  onZoomChangeRef.current = onZoomChange;
  labelProfileRef.current = labelProfile;
  showWorkspaceSublabelRef.current = showWorkspaceSublabel;

  useEffect(() => {
    if (labelProfile === "detailed") {
      setConfig((prev) =>
        mergeConfigPatch(prev, { labelMode: "always", showLabels: true })
      );
      return;
    }
    if (largeGraphMode || labelProfile === "compact") {
      setConfig((prev) =>
        mergeConfigPatch(prev, {
          labelMode: "onHover",
          velocityDecay: 0.55,
          chargeStrength: -220,
        })
      );
    }
  }, [largeGraphMode, labelProfile]);

  useEffect(() => {
    shouldAutoFitRef.current = true;
    savedTransformRef.current = null;
  }, [viewResetKey]);

  const d3Refs = useRef<{
    simulation: d3.Simulation<D3Node, D3Edge> | null;
    link: d3.Selection<SVGLineElement, D3Edge, SVGGElement, unknown> | null;
    node: d3.Selection<SVGCircleElement, D3Node, SVGGElement, unknown> | null;
    labelGroups: d3.Selection<SVGGElement, D3Node, SVGGElement, unknown> | null;
    g: d3.Selection<SVGGElement, unknown, null, undefined> | null;
    zoom: d3.ZoomBehavior<SVGSVGElement, unknown> | null;
    zoomSurface: d3.Selection<SVGRectElement, unknown, null, undefined> | null;
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null;
  }>({
    simulation: null,
    link: null,
    node: null,
    labelGroups: null,
    g: null,
    zoom: null,
    zoomSurface: null,
    svg: null,
  });

  const graphData = useMemo(() => {
    const uniqueNodesMap = new Map<string, GraphNode>();
    initialNodes.forEach((node) => uniqueNodesMap.set(node.id, node));

    const nodeDegrees = new Map<string, number>();
    initialEdges.forEach((edge) => {
      nodeDegrees.set(edge.source as string, (nodeDegrees.get(edge.source as string) || 0) + 1);
      nodeDegrees.set(edge.target as string, (nodeDegrees.get(edge.target as string) || 0) + 1);
    });

    const nodes: D3Node[] = Array.from(uniqueNodesMap.values()).map((node) => ({
      ...node,
      degree: nodeDegrees.get(node.id) || 0,
    }));

    const edges: D3Edge[] = initialEdges.map((edge) => ({
      ...edge,
      source: edge.source,
      target: edge.target,
    }));

    return { nodes, edges };
  }, [initialNodes, initialEdges]);

  const focusDepthRef = useRef(focusDepth);
  focusDepthRef.current = Math.max(1, focusDepth);

  const syncLabelBackground = useCallback(
    (labelGroup: d3.Selection<SVGGElement, D3Node, SVGGElement, unknown>) => {
      const g = d3Refs.current.g;
      if (!g) return;

      const k = d3.zoomTransform(g.node()!).k;
      const mainSize = labelFontSizeScreenPx(k);
      const subSize = workspaceSublabelFontSizeScreenPx(k);

      labelGroup.each(function (d: D3Node) {
        const group = d3.select(this);
        const mainText = group.select<SVGTextElement>(".label-text");
        mainText.attr("font-size", `${mainSize}px`);

        const wsRaw = d.attributes?.__kb_workspace;
        const wsName = typeof wsRaw === "string" ? wsRaw : "";
        const subText = group.select<SVGTextElement>(".label-workspace");
        if (!subText.empty()) {
          subText
            .attr("font-size", `${subSize}px`)
            .text(wsName ? truncateLabel(wsName, 20) : "");
        }

        const padding = 4;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        group.selectAll<SVGGraphicsElement, unknown>("text").each(function () {
          const box = (this as SVGGraphicsElement).getBBox();
          if (box.width === 0 && box.height === 0) return;
          minX = Math.min(minX, box.x);
          minY = Math.min(minY, box.y);
          maxX = Math.max(maxX, box.x + box.width);
          maxY = Math.max(maxY, box.y + box.height);
        });

        if (minX === Infinity) return;
        group
          .select(".label-background")
          .attr("x", minX - padding)
          .attr("y", minY - padding)
          .attr("width", maxX - minX + 2 * padding)
          .attr("height", maxY - minY + 2 * padding);
      });
    },
    []
  );

  const updateHighlighting = useCallback(() => {
    const { link, node, labelGroups, g } = d3Refs.current;
    if (!link || !node || !labelGroups || !g) return;

    const cfg = configRef.current;
    const hoveredId = hoveredNodeIdRef.current;
    const selectedId = selectedItem?.id ?? null;

    const emphasisId =
      selectedId ?? (cfg.labelMode === "onHover" ? hoveredId : null);

    const emphasisIds = emphasisId
      ? getNodeIdsWithinDepth(emphasisId, focusDepthRef.current, graphData.edges)
      : null;

    const selectionEmphasisIds = selectedId
      ? getNodeIdsWithinDepth(selectedId, focusDepthRef.current, graphData.edges)
      : null;

    const hoverEmphasisIds = hoveredId
      ? getNodeIdsWithinDepth(hoveredId, focusDepthRef.current, graphData.edges)
      : null;

    const getNodeTier = (d: D3Node): NodeFocusTier => {
      if (!emphasisId || !emphasisIds) return "none";
      if (d.id === emphasisId) return "focus";
      if (emphasisIds.has(d.id)) return "neighborhood";
      return "faded";
    };

    const zoomK = g?.node() ? d3.zoomTransform(g.node()!).k : 1;

    const isLabelVisible = (d: D3Node): boolean =>
      shouldShowNodeLabel({
        zoomK,
        labelMode: cfg.labelMode,
        profile: labelProfileRef.current,
        nodeId: d.id,
        nodeDegree: d.degree ?? 0,
        selectedId,
        hoveredId,
        emphasisIds,
        selectionEmphasisIds,
        hoverEmphasisIds,
      });

    const isEdgeEmphasized = (d: D3Edge) => {
      if (!emphasisIds) return true;
      const sid = (d.source as D3Node).id ?? String(d.source);
      const tid = (d.target as D3Node).id ?? String(d.target);
      return emphasisIds.has(sid) && emphasisIds.has(tid);
    };

    const nodeR = cfg.nodeRadius;
    const fadedNodeOpacity = 0.4;
    const fadedEdgeOpacity = 0.2;
    const normalEdgeOpacity = 0.45;

    if (!cfg.showEdges) {
      link.style("display", "none");
    } else if (!emphasisId) {
      link
        .attr("stroke-width", 1)
        .attr("stroke", getEdgeD3Color(false))
        .attr("stroke-opacity", normalEdgeOpacity)
        .style("display", null);
    } else {
      link
        .attr("stroke-width", (d) => (isEdgeEmphasized(d) ? 2 : 1))
        .attr("stroke", (d) => getEdgeD3Color(!isEdgeEmphasized(d)))
        .attr("stroke-opacity", (d) =>
          isEdgeEmphasized(d) ? 0.85 : fadedEdgeOpacity
        )
        .style("display", null);
    }

    node
      .attr("r", (d) => (getNodeTier(d) === "focus" ? nodeR + 2 : nodeR))
      .attr("fill", (d) => {
        const tier = getNodeTier(d);
        return getNodeD3Colors(d.type, tier === "faded").fill;
      })
      .attr("stroke", (d) => {
        const tier = getNodeTier(d);
        return getNodeD3Colors(d.type, tier === "faded").stroke;
      })
      .attr("opacity", (d) => {
        const tier = getNodeTier(d);
        if (tier === "none" || tier === "focus" || tier === "neighborhood") return 1;
        return fadedNodeOpacity;
      })
      .style("display", null)
      .attr("class", (d) =>
        cn(
          "cursor-pointer",
          selectedId === d.id ? "ring-4 ring-offset-2 ring-primary" : "hover:ring-2 hover:ring-primary/50"
        )
      );

    if (!cfg.showLabels) {
      labelGroups.style("display", "none");
      return;
    }

    labelGroups.each(function (d: D3Node) {
      const group = d3.select(this);
      if (!isLabelVisible(d)) {
        group.attr("opacity", 0).style("display", "none");
        return;
      }

      const tier = getNodeTier(d);
      let labelOpacity = 1;
      if (cfg.labelMode === "always" && selectedId) {
        if (tier === "faded") labelOpacity = 0.35;
        else if (tier === "neighborhood") labelOpacity = 0.85;
      } else if (cfg.labelMode === "onSelect" && selectedId) {
        labelOpacity = d.id === selectedId ? 1 : 0.9;
      }

      group.attr("opacity", labelOpacity).style("display", "block");

      const wsRaw = d.attributes?.__kb_workspace;
      const wsName = typeof wsRaw === "string" ? wsRaw : null;
      const showSub = shouldShowWorkspaceSublabel({
        zoomK,
        profile: labelProfileRef.current,
        workspaceName: wsName,
        nodeId: d.id,
        selectedId,
        hoveredId,
        emphasisIds,
      });
      const subText = group.select<SVGTextElement>(".label-workspace");
      if (!subText.empty()) {
        subText.style("display", showSub && showWorkspaceSublabelRef.current ? "block" : "none");
      }
    });

    syncLabelBackground(
      labelGroups.filter(function (d: D3Node) {
        return isLabelVisible(d);
      })
    );
  }, [selectedItem, graphData.edges, syncLabelBackground]);

  updateHighlightingRef.current = updateHighlighting;

  const applyNodeVisibility = useCallback((visibleIds: Set<string> | null) => {
    const { node, link, labelGroups } = d3Refs.current;
    if (!node || !link) return;

    const isVisible = (id: string) => !visibleIds || visibleIds.has(id);

    node
      .style("display", (d) => (isVisible(d.id) ? null : "none"))
      .style("pointer-events", (d) => (isVisible(d.id) ? "all" : "none"));

    link.style("display", (d) => {
      const sid = (d.source as D3Node).id ?? String(d.source);
      const tid = (d.target as D3Node).id ?? String(d.target);
      return isVisible(sid) && isVisible(tid) ? null : "none";
    });

    labelGroups?.style("display", (d) => (isVisible(d.id) ? null : "none"));
    updateHighlightingRef.current();
  }, []);

  const fitView = useCallback(() => {
    const { zoom, svg, g } = d3Refs.current;
    const sim = d3Refs.current.simulation;
    if (!zoom || !svg?.node() || !g || !sim) return;

    const nodes = sim.nodes();
    const positioned = nodes.filter((n) => n.x != null && n.y != null);
    if (positioned.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const pad = configRef.current.nodeRadius + 20;

    positioned.forEach((n) => {
      minX = Math.min(minX, n.x! - pad);
      minY = Math.min(minY, n.y! - pad);
      maxX = Math.max(maxX, n.x! + pad);
      maxY = Math.max(maxY, n.y! + pad);
    });

    const dx = maxX - minX || 1;
    const dy = maxY - minY || 1;
    const w = width;
    const h = height;
    const scale = Math.min(8, 0.92 / Math.max(dx / w, dy / h));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const transform = d3.zoomIdentity.translate(w / 2, h / 2).scale(scale).translate(-cx, -cy);

    svg.transition().duration(400).call(zoom.transform as never, transform);
    onZoomChangeRef.current?.(scale);
    updateHighlightingRef.current();
  }, [width, height]);

  fitViewRef.current = fitView;

  const restartLayout = useCallback(() => {
    const sim = d3Refs.current.simulation;
    if (!sim) return;
    sim.nodes().forEach((n) => {
      n.fx = null;
      n.fy = null;
    });
    sim.alpha(1).restart();
  }, []);

  const handleConfigChange = useCallback((patch: Partial<GraphSimulationConfig>) => {
    setConfig((prev) => {
      const next = mergeConfigPatch(prev, patch);
      setStoredGraphConfig(next);
      return next;
    });
  }, []);

  const handleResetDefaults = useCallback(() => {
    const next = { ...DEFAULT_GRAPH_SIMULATION_CONFIG };
    setStoredGraphConfig(next);
    setConfig(next);
  }, []);

  const drag = useCallback((simulation: d3.Simulation<D3Node, D3Edge>) => {
    function dragstarted(event: d3.D3DragEvent<SVGCircleElement, D3Node, D3Node>) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: d3.D3DragEvent<SVGCircleElement, D3Node, D3Node>) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGCircleElement, D3Node, D3Node>) {
      if (!event.active) simulation.alphaTarget(0);
    }

    return d3
      .drag<SVGCircleElement, D3Node>()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }, []);

  useEffect(() => {
    if (!svgRef.current || graphData.nodes.length === 0) {
      d3.select(svgRef.current).selectAll("*").remove();
      d3Refs.current.simulation?.stop();
      d3Refs.current = {
        simulation: null,
        link: null,
        node: null,
        labelGroups: null,
        g: null,
        zoom: null,
        zoomSurface: null,
        svg: null,
      };
      return;
    }

    hoveredNodeIdRef.current = null;
    const restoreTransform =
      !shouldAutoFitRef.current ? savedTransformRef.current : null;
    savedTransformRef.current = null;

    const svg = d3.select(svgRef.current);
    const container = svg.node()?.parentElement;
    const w = container?.clientWidth ?? width;
    const h = container?.clientHeight ?? height;
    setWidth(w);
    setHeight(h);

    svg.selectAll("*").remove();

    const cfg = configRef.current;

    const zoomSurface = svg
      .append("rect")
      .attr("class", "graph-zoom-surface")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", w)
      .attr("height", h)
      .attr("fill", "transparent")
      .style("pointer-events", "all")
      .on("click", () => {
        onSelectRef.current(null);
        hoveredNodeIdRef.current = null;
        updateHighlightingRef.current();
        onGraphBackgroundClickRef.current();
      });

    const g = svg.append("g").attr("class", "graph-root");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.08, 12])
      .filter((event) => {
        const target = event.target as Element | null;
        if (target?.closest?.("[data-kb-overlay]")) return false;
        if (event.type === "wheel") return true;
        if (target?.closest?.("circle")) return false;
        return true;
      })
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        onZoomChangeRef.current?.(event.transform.k);
        updateHighlightingRef.current();
      });

    svg.call(zoom as never);
    if (restoreTransform) {
      svg.call(zoom.transform as never, restoreTransform);
    }

    const simulation = d3.forceSimulation<D3Node, D3Edge>(graphData.nodes);
    applySimulationForces(simulation, graphData.edges, cfg, w, h);

    const link = g
      .append("g")
      .attr("class", "links")
      .selectAll<SVGLineElement, D3Edge>("line")
      .data(graphData.edges)
      .join("line")
      .attr("pointer-events", "none")
      .attr("stroke-opacity", 0.45);

    const node = g
      .append("g")
      .attr("stroke-width", 2)
      .selectAll<SVGCircleElement, D3Node>("circle")
      .data(graphData.nodes)
      .join("circle")
      .attr("r", cfg.nodeRadius)
      .on("click", (event, d) => {
        event.stopPropagation();
        onSelectRef.current(cleanNodeData(d));
      })
      .on("dblclick", (event, d) => {
        event.stopPropagation();
        d.fx = null;
        d.fy = null;
        simulation.alpha(0.3).restart();
      })
      .on("mouseenter", (_event, d) => {
        hoveredNodeIdRef.current = d.id;
        updateHighlightingRef.current();
      })
      .on("mouseleave", () => {
        hoveredNodeIdRef.current = null;
        updateHighlightingRef.current();
      })
      .call(drag(simulation) as never);

    const labelGroups = g
      .append("g")
      .attr("class", "labels")
      .selectAll<SVGGElement, D3Node>(".node-label-group")
      .data(graphData.nodes)
      .join("g")
      .attr("class", "node-label-group")
      .attr("pointer-events", "none");

    labelGroups
      .append("rect")
      .attr("class", "label-background")
      .attr("fill", "hsl(var(--background))")
      .attr("stroke", "hsl(var(--border))")
      .attr("rx", 3)
      .attr("ry", 3)
      .attr("opacity", 0.92);

    const labelMain = labelGroups
      .append("text")
      .attr("class", "label-text select-none")
      .text((d) => truncateLabel(d.label))
      .attr("text-anchor", "middle")
      .attr("dy", "-0.15em")
      .attr("fill", "hsl(var(--foreground))");

    if (showWorkspaceSublabelRef.current) {
      labelGroups
        .append("text")
        .attr("class", "label-workspace select-none")
        .attr("text-anchor", "middle")
        .attr("dy", "1.05em")
        .attr("fill", "hsl(var(--muted-foreground))")
        .style("display", "none")
        .text("");
    }

    void labelMain;

    const svgEl = svgRef.current;
    if (svgEl) {
      svgEl.style.pointerEvents = "all";
    }

    simulation.on("tick", () => {
      const r = configRef.current.nodeRadius;
      link
        .attr("x1", (d) => (d.source as D3Node).x!)
        .attr("y1", (d) => (d.source as D3Node).y!)
        .attr("x2", (d) => (d.target as D3Node).x!)
        .attr("y2", (d) => (d.target as D3Node).y!);

      node.attr("cx", (d) => d.x!).attr("cy", (d) => d.y!);

      labelGroups.attr("transform", (d) => `translate(${d.x},${d.y! - r - 6})`);
    });

    simulation.on("end", () => {
      if (shouldAutoFitRef.current) {
        shouldAutoFitRef.current = false;
        fitViewRef.current();
      }
    });

    d3Refs.current = { simulation, link, node, labelGroups, g, zoom, zoomSurface, svg };
    applyNodeVisibility(visibleNodeIds);
    updateHighlightingRef.current();
    simulation.alpha(1).restart();

    return () => {
      const { g } = d3Refs.current;
      if (g?.node() && !shouldAutoFitRef.current) {
        savedTransformRef.current = d3.zoomTransform(g.node()!);
      }
      simulation.stop();
    };
  }, [graphData, drag, applyNodeVisibility]);

  const visibleNodeIdsKey = useMemo(() => {
    if (visibleNodeIds === null) return "__all__";
    if (visibleNodeIds.size === 0) return "__none__";
    return [...visibleNodeIds].sort().join("\0");
  }, [visibleNodeIds]);

  const visibleNodeIdsRef = useRef(visibleNodeIds);
  visibleNodeIdsRef.current = visibleNodeIds;

  useEffect(() => {
    applyNodeVisibility(visibleNodeIdsRef.current);
  }, [visibleNodeIdsKey, applyNodeVisibility]);

  useEffect(() => {
    const { simulation } = d3Refs.current;
    if (!simulation) return;
    applySimulationForces(simulation, graphData.edges, config, width, height);
    simulation.alpha(0.3).restart();
    updateHighlighting();
  }, [config, graphData.edges, width, height, updateHighlighting]);

  useEffect(() => {
    updateHighlighting();
  }, [selectedItem, updateHighlighting]);

  useEffect(() => {
    const container = svgRef.current?.parentElement;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        setWidth(w);
        setHeight(h);
        d3Refs.current.zoomSurface?.attr("width", w).attr("height", h);
        const sim = d3Refs.current.simulation;
        if (sim) {
          applySimulationForces(sim, graphData.edges, configRef.current, w, h);
          sim.alpha(0.2).restart();
        }
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [graphData.edges]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg bg-background">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        className="absolute inset-0 z-0 touch-none bg-background"
      />
      {bottomLeftOverlay && (
        <div className="pointer-events-none absolute bottom-[var(--kb-graph-inset)] left-[var(--kb-graph-inset)] z-[100] flex w-72 max-h-[var(--kb-bottom-overlay-max-h)] min-h-0 flex-col justify-end">
          {bottomLeftOverlay}
        </div>
      )}
      {showControls && graphData.nodes.length > 0 && (
        <div className="pointer-events-none absolute bottom-[var(--kb-graph-inset)] right-[var(--kb-graph-inset)] z-[100] flex w-72 max-h-[var(--kb-bottom-overlay-max-h)] min-h-0 flex-col justify-end">
          <GraphSimulationControls
            className="pointer-events-auto w-full min-h-0 max-w-none"
            config={config}
            onChange={handleConfigChange}
            onRestartLayout={restartLayout}
            onFitView={fitView}
            onResetDefaults={handleResetDefaults}
            open={graphControlsOpen}
            onOpenChange={onGraphControlsOpenChange}
          />
        </div>
      )}
    </div>
  );
};

interface LocalDetailPanelProps {
  item: GraphNode | null;
}

const LocalDetailPanel: React.FC<LocalDetailPanelProps> = ({ item }) => {
  if (!item) {
    return (
      <div className="text-muted-foreground p-4">
        Click on a node in the graph to see details.
      </div>
    );
  }

  const displayAttributes = Object.entries(item.attributes).filter(
    ([key]) => key !== "__kb_workspace"
  );

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center space-x-2">
        <span
          className={cn("h-4 w-4 rounded-full")}
          style={{ backgroundColor: colorScale(item.type) }}
        />
        <h4 className="max-w-[65%] flex-1 break-words text-lg font-semibold">{item.label}</h4>
      </div>
      <p className="max-w-[95%] break-words text-sm text-muted-foreground">
        Source Document:{" "}
        <span className="break-all font-medium text-foreground">
          {item.source.join(", ") || "—"}
        </span>
      </p>
      <div className="rounded-md border bg-secondary/50 p-3">
        {displayAttributes.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {displayAttributes.map(([key, value]) => (
              <li key={key} className="break-words">
                <span className="font-mono text-xs text-primary/80">{key}:</span>{" "}
                {String(value)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No specific attributes found.</p>
        )}
      </div>
    </div>
  );
};

export { InteractiveGraphVisualization, LocalDetailPanel as DetailPanel, colorScale };
