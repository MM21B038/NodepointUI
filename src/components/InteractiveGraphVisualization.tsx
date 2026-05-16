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

const colorScale = d3.scaleOrdinal(d3.schemeSet3);

const LABEL_TRUNCATE_LEN = 28;
const LABEL_MIN_FONT_PX = 9;
const LABEL_BASE_FONT_PX = 11;

const getNodeD3Colors = (type: string, isDesaturated: boolean) => {
  if (isDesaturated) {
    return { fill: "transparent", stroke: "transparent" };
  }
  const fill = colorScale(type);
  const stroke = d3.color(fill)?.darker(1.8).toString() || "#000000";
  return { fill, stroke };
};

const getEdgeD3Color = (isDesaturated: boolean) => {
  return isDesaturated ? "transparent" : "hsl(var(--muted-foreground))";
};

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
}

type D3Node = GraphNode & d3.SimulationNodeDatum & { degree?: number };
type D3Edge = GraphEdge & { source: D3Node | string; target: D3Node | string };

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
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(400);
  const [config, setConfig] = useState<GraphSimulationConfig>(() => getStoredGraphConfig());

  const configRef = useRef(config);
  configRef.current = config;

  const hoveredNodeIdRef = useRef<string | null>(null);
  const shouldAutoFitRef = useRef(true);
  const updateHighlightingRef = useRef<() => void>(() => {});
  const fitViewRef = useRef<() => void>(() => {});

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

  const getNeighborIds = useCallback(
    (nodeId: string) => {
      const neighbors = new Set<string>();
      graphData.edges.forEach((edge) => {
        const sid = (edge.source as D3Node).id ?? (edge.source as string);
        const tid = (edge.target as D3Node).id ?? (edge.target as string);
        if (sid === nodeId) neighbors.add(tid);
        else if (tid === nodeId) neighbors.add(sid);
      });
      return neighbors;
    },
    [graphData.edges]
  );

  const syncLabelBackground = useCallback(
    (labelGroup: d3.Selection<SVGGElement, D3Node, SVGGElement, unknown>) => {
      const g = d3Refs.current.g;
      if (!g) return;

      const k = d3.zoomTransform(g.node()!).k;
      const fontSize = Math.max(LABEL_MIN_FONT_PX, LABEL_BASE_FONT_PX / k);

      labelGroup.each(function () {
        const group = d3.select(this);
        const text = group.select<SVGTextElement>(".label-text");
        text.attr("font-size", `${fontSize}px`);
        const textNode = text.node();
        if (!textNode) return;
        const bbox = textNode.getBBox();
        const padding = 4;
        group
          .select(".label-background")
          .attr("x", bbox.x - padding)
          .attr("y", bbox.y - padding)
          .attr("width", bbox.width + 2 * padding)
          .attr("height", bbox.height + 2 * padding);
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

    const focusId = selectedId ?? (cfg.labelMode === "onHover" ? hoveredId : null);

    const neighborIds = focusId ? getNeighborIds(focusId) : new Set<string>();

    const isNodeHighlighted = (d: D3Node) => {
      if (!focusId) return true;
      if (d.id === focusId) return true;
      return neighborIds.has(d.id);
    };

    const isEdgeHighlighted = (d: D3Edge) => {
      if (!focusId) return true;
      const sid = (d.source as D3Node).id;
      const tid = (d.target as D3Node).id;
      return sid === focusId || tid === focusId;
    };

    const nodeR = cfg.nodeRadius;
    const dimmedEdgeOpacity = 0.12;
    const normalEdgeOpacity = 0.45;

    if (!cfg.showEdges) {
      link.style("display", "none");
    } else if (!focusId) {
      link
        .attr("stroke-width", 1)
        .attr("stroke", getEdgeD3Color(false))
        .attr("stroke-opacity", normalEdgeOpacity)
        .style("display", null);
    } else {
      link
        .attr("stroke-width", (d) => (isEdgeHighlighted(d) ? 2 : 1))
        .attr("stroke", (d) => getEdgeD3Color(!isEdgeHighlighted(d)))
        .attr("stroke-opacity", (d) => (isEdgeHighlighted(d) ? 0.85 : dimmedEdgeOpacity))
        .style("display", null);
    }

    node
      .attr("r", (d) => (focusId && d.id === focusId ? nodeR + 2 : nodeR))
      .attr("fill", (d) => getNodeD3Colors(d.type, focusId ? !isNodeHighlighted(d) : false).fill)
      .attr("stroke", (d) => getNodeD3Colors(d.type, focusId ? !isNodeHighlighted(d) : false).stroke)
      .attr("opacity", (d) => (focusId && !isNodeHighlighted(d) ? 0.15 : 1))
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

    labelGroups.style("display", null);
    labelGroups.each(function (d: D3Node) {
      const group = d3.select(this);
      let visible = true;
      if (cfg.labelMode === "onSelect") {
        visible = !focusId || isNodeHighlighted(d);
      } else if (cfg.labelMode === "onHover") {
        visible = !hoveredId || isNodeHighlighted(d);
      }
      group.attr("opacity", visible ? 1 : 0).style("display", visible ? "block" : "none");
    });

    syncLabelBackground(labelGroups);
  }, [selectedItem, getNeighborIds, syncLabelBackground]);

  updateHighlightingRef.current = updateHighlighting;

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

    shouldAutoFitRef.current = true;
    hoveredNodeIdRef.current = null;

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
        onSelect(null);
        hoveredNodeIdRef.current = null;
        updateHighlightingRef.current();
        onGraphBackgroundClick();
      });

    const g = svg.append("g").attr("class", "graph-root");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.08, 12])
      .filter((event) => {
        if (event.type === "wheel") return true;
        const target = event.target as Element | null;
        if (target?.closest?.("circle")) return false;
        return true;
      })
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        updateHighlightingRef.current();
      });

    svg.call(zoom as never);

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
        onSelect(cleanNodeData(d));
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

    labelGroups
      .append("text")
      .attr("class", "label-text select-none")
      .text((d) => truncateLabel(d.label))
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("fill", "hsl(var(--foreground))");

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
    updateHighlightingRef.current();
    simulation.alpha(1).restart();

    return () => {
      simulation.stop();
    };
  }, [graphData, onSelect, drag, onGraphBackgroundClick]);

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
    <div className="relative h-full w-full rounded-lg bg-background">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        className="absolute inset-0 z-0 touch-none bg-background"
      />
      {showControls && graphData.nodes.length > 0 && (
        <GraphSimulationControls
          className="absolute bottom-3 left-3 right-3 z-[100] flex max-h-[calc(100%-5rem)] w-auto max-w-none flex-col sm:left-auto sm:right-3 sm:w-72"
          config={config}
          onChange={handleConfigChange}
          onRestartLayout={restartLayout}
          onFitView={fitView}
          onResetDefaults={handleResetDefaults}
        />
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
