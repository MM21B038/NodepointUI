"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as d3 from "d3";
import { GraphNode, GraphEdge } from "@/database/workspaceStorage";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

// --- D3 Color Scale for Visualization ---
// Using d3.schemeSet3 which provides 12 bright, distinct colors.
const colorScale = d3.scaleOrdinal(d3.schemeSet3);

// Function to get D3 colors based on node type and saturation state
const getNodeD3Colors = (type: string, isDesaturated: boolean) => {
  if (isDesaturated) {
    return { fill: "transparent", stroke: "transparent" }; // Completely transparent
  }
  const fill = colorScale(type);
  // Calculate a darker stroke color for contrast
  const stroke = d3.color(fill)?.darker(1.8).toString() || '#000000';
  return { fill, stroke };
};

// Function to get D3 color for edges based on saturation state
const getEdgeD3Color = (isDesaturated: boolean) => {
  return isDesaturated ? "transparent" : "hsl(var(--muted-foreground))"; // Completely transparent
};


interface InteractiveGraphVisualizationProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onSelect: (item: GraphNode | GraphEdge | null) => void;
  selectedItem: GraphNode | GraphEdge | null;
}

// D3 requires nodes to have x, y, vx, vy properties, and we add 'degree'
type D3Node = GraphNode & d3.SimulationNodeDatum & { degree?: number };
type D3Edge = GraphEdge & { source: D3Node | string; target: D3Node | string };

// Helper function to clean D3 properties from a node
const cleanNodeData = (d: D3Node): GraphNode => ({
    id: d.id,
    label: d.label,
    type: d.type,
    source: d.source,
    workspace: d.workspace,
    attributes: d.attributes,
});

// Helper function to clean D3 properties from an edge
const cleanEdgeData = (d: D3Edge): GraphEdge => ({
    // D3 resolves source/target to D3Node objects, we extract the original ID string
    source: (d.source as D3Node).id,
    target: (d.target as D3Node).id,
    label: d.label,
    score: d.score,
    source_file: d.source_file,
});


const InteractiveGraphVisualization: React.FC<InteractiveGraphVisualizationProps> = ({
  nodes: initialNodes,
  edges: initialEdges,
  onSelect,
  selectedItem,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(400);

  // Store D3 selections and simulation instance in refs to persist across renders
  const d3Refs = useRef<{
    simulation: d3.Simulation<D3Node, D3Edge> | null;
    link: d3.Selection<SVGLineElement, D3Edge, SVGGElement, unknown> | null;
    node: d3.Selection<SVGCircleElement, D3Node, SVGGElement, unknown> | null;
    labelGroups: d3.Selection<SVGGElement, D3Node, SVGGElement, unknown> | null;
    g: d3.Selection<SVGGElement, unknown, HTMLElement, undefined> | null;
    zoom: d3.ZoomBehavior<SVGSVGElement, unknown> | null;
  }>({
    simulation: null,
    link: null,
    node: null,
    labelGroups: null,
    g: null,
    zoom: null,
  });

  // Memoize D3 data structure and calculate node degrees
  const graphData = useMemo(() => {
    const uniqueNodesMap = new Map<string, GraphNode>();
    initialNodes.forEach(node => uniqueNodesMap.set(node.id, node));
    
    // Calculate node degrees
    const nodeDegrees = new Map<string, number>();
    initialEdges.forEach(edge => {
      nodeDegrees.set(edge.source as string, (nodeDegrees.get(edge.source as string) || 0) + 1);
      nodeDegrees.set(edge.target as string, (nodeDegrees.get(edge.target as string) || 0) + 1);
    });

    const nodes: D3Node[] = Array.from(uniqueNodesMap.values()).map(node => ({
      ...node,
      degree: nodeDegrees.get(node.id) || 0, // Add degree to D3Node
      x: undefined,
      y: undefined,
      vx: undefined,
      vy: undefined,
    }));

    const edges: D3Edge[] = initialEdges.map(edge => ({
      ...edge,
      source: edge.source,
            target: edge.target,
    }));

    return { nodes, edges };
  }, [initialNodes, initialEdges]);

  // --- Drag Handlers ---
  const drag = useCallback((simulation: d3.Simulation<D3Node, D3Edge>) => {
    function dragstarted(event: d3.D3DragEvent<SVGCircleElement, D3Node, D3Node>, d: D3Node) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: d3.D3DragEvent<SVGCircleElement, D3Node, D3Node>, d: D3Node) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGCircleElement, D3Node, D3Node>, d: D3Node) {
      if (!event.active) simulation.alphaTarget(0); // Let simulation decay naturally
      // d.fx = null;
      // d.fy = null;
    }

    return d3.drag<SVGCircleElement, D3Node>()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }, []);

  // --- Update Highlighting Function ---
  const updateHighlighting = useCallback(() => {
    const { link, node, labelGroups, g, zoom } = d3Refs.current;
    if (!link || !node || !labelGroups || !g || !zoom) return;

    const selectedNodeId = selectedItem && 'id' in selectedItem ? selectedItem.id : null;
    const selectedEdge = selectedItem && 'source' in selectedItem && 'target' in selectedItem ? selectedItem : null;

    const neighborNodeIds = new Set<string>();
    if (selectedNodeId) {
      graphData.edges.forEach(edge => {
        if ((edge.source as D3Node).id === selectedNodeId) {
          neighborNodeIds.add((edge.target as D3Node).id);
        } else if ((edge.target as D3Node).id === selectedNodeId) {
          neighborNodeIds.add((edge.source as D3Node).id);
        }
      });
    } else if (selectedEdge) {
      // If an edge is selected, its source and target nodes are neighbors
      neighborNodeIds.add(selectedEdge.source as string);
      neighborNodeIds.add(selectedEdge.target as string);
    }

    const isNodeHighlighted = (d: D3Node) => {
      if (!selectedItem) return true; // All visible if nothing selected
      if (selectedNodeId && d.id === selectedNodeId) return true; // Selected node
      if (selectedNodeId && neighborNodeIds.has(d.id)) return true; // Neighbors of selected node
      if (selectedEdge && (selectedEdge.source === d.id || selectedEdge.target === d.id)) return true; // Nodes connected to selected edge
      return false;
    };

    const isEdgeHighlighted = (d: D3Edge) => {
      if (!selectedItem) return true; // All visible if nothing selected
      // Check if this is the selected edge itself
      if (selectedEdge && selectedEdge.source === (d.source as D3Node).id && selectedEdge.target === (d.target as D3Node).id) return true;
      // Check if this edge is connected to the selected node
      if (selectedNodeId && ((d.source as D3Node).id === selectedNodeId || (d.target as D3Node).id === selectedNodeId)) return true;
      return false;
    };

    link
      .attr("stroke-width", d => isEdgeHighlighted(d) ? 3 : 1) // Thicker stroke for highlighted edges
      .attr("stroke", d => getEdgeD3Color(!isEdgeHighlighted(d)))
      .attr("stroke-opacity", d => isEdgeHighlighted(d) ? 1 : 0); // Full opacity for highlighted, 0 for hidden

    node
      .attr("r", d => isNodeHighlighted(d) ? 12 : 10) // Larger radius for highlighted nodes
      .attr("fill", d => getNodeD3Colors(d.type, !isNodeHighlighted(d)).fill)
      .attr("stroke", d => getNodeD3Colors(d.type, !isNodeHighlighted(d)).stroke)
      .attr("opacity", d => isNodeHighlighted(d) ? 1 : 0) // Full opacity for highlighted, 0 for hidden
      .attr("class", d => cn(
        "cursor-pointer transition-all",
        selectedItem && 'id' in selectedItem && selectedItem.id === d.id ? "ring-4 ring-offset-2 ring-primary" : "hover:ring-2 hover:ring-primary/50"
      ));

    // Re-evaluate label opacity based on current zoom and highlighting
    const currentTransform = d3.zoomTransform(g.node()!);
    labelGroups.each(function(d: D3Node) {
      const currentLabelGroup = d3.select(this);
      const currentLabelText = currentLabelGroup.select(".label-text");
      const currentLabelBackground = currentLabelGroup.select(".label-background");

      const k = currentTransform.k;
      const baseFontSize = 10;
      currentLabelText.attr("font-size", `${baseFontSize / k}px`);

      const textNode = currentLabelText.node();
      if (!textNode) {
        console.warn(`InteractiveGraphVisualization: Label text node is null for node ID ${d.id}. Skipping getBBox calculation.`);
        return; 
      }
      const bbox = textNode.getBBox();
      const padding = 5;
      currentLabelBackground
        .attr("x", bbox.x - padding)
        .attr("y", bbox.y - padding)
        .attr("width", bbox.width + 2 * padding)
        .attr("height", bbox.height + 2 * padding);

      if (!isNodeHighlighted(d)) {
        currentLabelGroup.attr("opacity", 0); // Keep labels hidden for non-highlighted nodes
        return;
      }

      const nodeDegree = d.degree || 0;
      const minZoomBase = 3.0;
      const maxZoomBase = 10.0;
      const degreeFactor = 1 + Math.log1p(nodeDegree);
      const effectiveMinZoom = minZoomBase / degreeFactor;
      const effectiveMaxZoom = maxZoomBase / (1 + Math.log1p(nodeDegree) / 2);
      const clampedEffectiveMinZoom = Math.max(0.1, effectiveMinZoom);
      const clampedEffectiveMaxZoom = Math.min(5.0, effectiveMaxZoom);

      const opacityScale = d3.scaleLinear()
        .domain([clampedEffectiveMinZoom, clampedEffectiveMaxZoom])
        .range([0, 1])
        .clamp(true);

      currentLabelGroup.attr("opacity", opacityScale(k));
    });

  }, [selectedItem, graphData]);

  // --- Effect for initial D3 setup and data changes ---
  useEffect(() => {
    if (!svgRef.current || graphData.nodes.length === 0) {
      // Clear existing D3 elements if no nodes or ref is null
      d3.select(svgRef.current).selectAll("*").remove();
      d3Refs.current.simulation?.stop();
      d3Refs.current = { simulation: null, link: null, node: null, labelGroups: null, g: null, zoom: null };
      return;
    }

    const svg = d3.select(svgRef.current);
    const container = svg.node()?.parentElement;
    if (container) {
      setWidth(container.clientWidth);
      setHeight(container.clientHeight);
    }

    // Clear previous elements before new setup
    svg.selectAll("*").remove();

    const g = svg.append("g");
    d3Refs.current.g = g; // Store the group element

    // --- D3 Force Simulation ---
    const simulation = d3.forceSimulation<D3Node, D3Edge>(graphData.nodes)
      .force("link", d3.forceLink<D3Node, D3Edge>(graphData.edges).id(d => d.id).distance(180))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX(width / 2).strength(0.05))
      .force("y", d3.forceY(height / 2).strength(0.05));
    d3Refs.current.simulation = simulation; // Store simulation instance

    // --- Render Elements ---

    // 1. Edges
    const link = g.append("g")
      .selectAll("line")
      .data(graphData.edges)
      .join("line")
      .attr("class", "cursor-pointer transition-all")
      .on("click", (event, d) => {
        event.stopPropagation();
        onSelect(cleanEdgeData(d));
        // d3Refs.current.simulation?.stop(); // Removed this line
      });
    d3Refs.current.link = link; // Store link selection

    // 2. Nodes
    const node = g.append("g")
      .attr("stroke-width", 3)
      .selectAll("circle")
      .data(graphData.nodes)
      .join("circle")
      .attr("r", 10)
      .attr("class", "transition-all") // Add transition for smoother highlighting
      .on("click", (event, d) => {
        event.stopPropagation();
        onSelect(cleanNodeData(d));
        // d3Refs.current.simulation?.stop(); // Removed this line
      })
      .call(drag(simulation) as any);
    d3Refs.current.node = node; // Store node selection

    // 3. Labels
    const labelGroups = g.append("g")
      .attr("class", "labels")
      .selectAll(".node-label-group")
      .data(graphData.nodes)
      .join("g")
      .attr("class", "node-label-group")
      .attr("pointer-events", "none")
      .attr("opacity", 0);
    d3Refs.current.labelGroups = labelGroups; // Store labelGroups selection

    labelGroups.append("rect")
      .attr("class", "label-background")
      .attr("fill", "hsl(var(--background))")
      .attr("stroke", "hsl(var(--border))")
      .attr("rx", 3)
      .attr("ry", 3);

    labelGroups.append("text")
      .attr("class", "label-text")
      .text(d => d.label)
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("fill", "hsl(var(--foreground))")
      .attr("class", "select-none");

    // 4. Zoom functionality
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 100])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        // Re-evaluate label opacity and size on zoom
        updateHighlighting(); // This will also re-calculate label opacities based on new zoom
      });
    svg.call(zoom as any);
    d3Refs.current.zoom = zoom; // Store zoom behavior

    // 5. Tick function updates positions
    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as D3Node).x!)
        .attr("y1", d => (d.source as D3Node).y!)
        .attr("x2", d => (d.target as D3Node).x!)
        .attr("y2", d => (d.target as D3Node).y!);

      node
        .attr("cx", d => d.x!)
        .attr("cy", d => d.y!);
        
      labelGroups
        .attr("transform", d => `translate(${d.x},${d.y + 20})`);
    });

    // Handle click outside nodes/edges to deselect
    svg.on("click", () => {
      onSelect(null);
      // Do NOT restart simulation here. It should remain stable after deselecting.
    });
    
    // Initial highlighting update
    updateHighlighting();
    // Ensure simulation starts when data changes
    simulation.alpha(1).restart();


    // Cleanup function
    return () => {
      simulation.stop();
    };
  }, [graphData, width, height, onSelect, drag]); // Dependencies for initial setup

  // --- Effect for updating highlighting when selectedItem changes ---
  useEffect(() => {
    updateHighlighting();
  }, [selectedItem, updateHighlighting]); // Only re-run when selectedItem or updateHighlighting changes

  return (
    <div className="w-full h-full relative bg-background rounded-lg">
      <svg ref={svgRef} width="100%" height="100%" className="bg-background"></svg>
    </div>
  );
};

// --- Detail Panel Component ---

interface DetailPanelProps {
  item: GraphNode | GraphEdge | null;
}

const DetailPanel: React.FC<DetailPanelProps> = ({ item }) => {
  if (!item) {
    return (
      <div className="text-muted-foreground p-4">
        Click on a node or edge in the graph to see details.
      </div>
    );
  }

  if ('type' in item) {
    // Node details
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center space-x-2">
          {/* Use D3 color scale for consistency */}
          <span className={cn("h-4 w-4 rounded-full")} style={{ backgroundColor: colorScale(item.type) }}></span>
          {/* Ensure node label wraps aggressively */}
          <h4 className="text-lg font-semibold break-words flex-1 min-w-0 max-w-[65%]">{item.label}</h4>
          <Badge variant="secondary" className="absolute top-0 right-[5%] mt-4">{item.type}</Badge>
        </div>
        <p className="text-sm text-muted-foreground break-words max-w-[95%]">
          Workspace: <span className="font-medium text-foreground break-all">{item.workspace}</span>
        </p>
        <p className="text-sm text-muted-foreground break-words max-w-[95%]">
          Source Document: <span className="font-medium text-foreground break-all">{item.source as string}</span>
        </p>
        <Separator />
        <h5 className="font-medium text-sm max-w-[95%]">Attributes:</h5>
        <div className="border rounded-md p-3 bg-secondary/50">
          {Object.keys(item.attributes).length > 0 ? (
            <ul className="text-sm space-y-1">
              {Object.entries(item.attributes).map(([key, value]) => (
                <li key={key} className="break-words">
                  <span className="font-mono text-xs text-primary/80">{key}:</span> {String(value)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No specific attributes found.</p>
          )}
        </div>
      </div>
    );
  } else {
    // Edge details
    return (
      <div className="p-4 space-y-3">
        <h4 className="text-lg font-semibold">Relationship</h4>
        <p className="text-sm break-words">
          <span className="font-medium text-primary">{item.source as string}</span> 
          <span className="text-muted-foreground mx-2">--({item.label})--&gt;</span> 
          <span className="font-medium text-primary">{item.target as string}</span>
        </p>
        <Separator />
        <div className="text-sm space-y-1">
          <p className="break-words"><strong>Relationship Type:</strong> {item.label}</p>
          <p><strong>Score/Weight:</strong> {(item.score || 0).toFixed(2)}</p> {/* Safely access score */}
          <p className="break-words"><strong>Source Document:</strong> <span className="break-all">{item.source_file as string}</span></p>
        </div>
      </div>
    );
  }
};

export { InteractiveGraphVisualization, DetailPanel, colorScale };