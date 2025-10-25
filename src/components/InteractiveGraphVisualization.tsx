"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { GraphNode, GraphEdge } from "@/database/workspaceStorage";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

// Simple color mapping for node types (Tailwind classes)
const TYPE_COLORS: Record<string, string> = {
  'Person': 'bg-blue-500',
  'Organization': 'bg-green-500',
  'Concept': 'bg-purple-500',
  'Date': 'bg-yellow-500',
  'Location': 'bg-red-500',
  'default': 'bg-gray-400',
};

const getNodeColorClass = (type: string) => TYPE_COLORS[type] || TYPE_COLORS['default'];

interface InteractiveGraphVisualizationProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onSelect: (item: GraphNode | GraphEdge | null) => void;
  selectedItem: GraphNode | GraphEdge | null;
}

// D3 requires nodes to have x, y, vx, vy properties
type D3Node = GraphNode & d3.SimulationNodeDatum;
type D3Edge = GraphEdge & { source: D3Node | string; target: D3Node | string };

// Helper function to clean D3 properties from a node
const cleanNodeData = (d: D3Node): GraphNode => ({
    id: d.id,
    label: d.label,
    type: d.type,
    source: d.source,
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

  // Memoize D3 data structure
  const graphData = useMemo(() => {
    // Ensure nodes are unique by ID
    const uniqueNodesMap = new Map<string, GraphNode>();
    initialNodes.forEach(node => uniqueNodesMap.set(node.id, node));
    const nodes: D3Node[] = Array.from(uniqueNodesMap.values()).map(node => ({
      ...node,
      x: undefined,
      y: undefined,
      vx: undefined,
      vy: undefined,
    }));

    // Edges must reference node IDs
    const edges: D3Edge[] = initialEdges.map(edge => ({
      ...edge,
      source: edge.source,
      target: edge.target,
    }));

    return { nodes, edges };
  }, [initialNodes, initialEdges]);

  useEffect(() => {
    if (!svgRef.current || graphData.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    const container = svg.node()?.parentElement;
    if (container) {
      setWidth(container.clientWidth);
      setHeight(container.clientHeight);
    }

    // Clear previous elements
    svg.selectAll("*").remove();

    const g = svg.append("g");

    // Zoom functionality (optional but good practice for D3 graphs)
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    svg.call(zoom as any);

    // Define marker for directed edges
    svg.append("defs").append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 15) // Position marker slightly away from node center
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "hsl(var(--foreground))");

    // --- D3 Force Simulation ---
    const simulation = d3.forceSimulation<D3Node, D3Edge>(graphData.nodes)
      .force("link", d3.forceLink<D3Node, D3Edge>(graphData.edges).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX(width / 2).strength(0.05))
      .force("y", d3.forceY(height / 2).strength(0.05));

    // --- Render Elements ---

    // 1. Edges
    const link = g.append("g")
      .attr("stroke", "hsl(var(--muted-foreground))")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(graphData.edges)
      .join("line")
      .attr("stroke-width", 1)
      .attr("marker-end", "url(#arrowhead)")
      .on("click", (event, d) => {
        event.stopPropagation();
        onSelect(cleanEdgeData(d));
      })
      .attr("class", d => cn(
        "cursor-pointer transition-all",
        selectedItem && 'source_file' in selectedItem && selectedItem.source_file === d.source_file ? "stroke-primary" : "hover:stroke-primary/80"
      ));

    // 2. Nodes
    const node = g.append("g")
      .attr("stroke", "hsl(var(--border))")
      .attr("stroke-width", 2)
      .selectAll("circle")
      .data(graphData.nodes)
      .join("circle")
      .attr("r", 10)
      .attr("fill", d => {
        const colorClass = getNodeColorClass(d.type);
        // Extract HSL values from Tailwind CSS variables (approximation for D3 fill)
        // Since we can't easily read computed styles in D3, we use a fixed color for now
        return colorClass.includes('blue') ? 'hsl(222.2 47.4% 11.2%)' : 'hsl(210 40% 96.1%)';
      })
      .attr("class", d => cn(
        "cursor-pointer transition-all",
        getNodeColorClass(d.type),
        selectedItem && 'id' in selectedItem && selectedItem.id === d.id ? "ring-4 ring-offset-2 ring-primary" : "hover:ring-2 hover:ring-primary/50"
      ))
      .on("click", (event, d) => {
        event.stopPropagation();
        onSelect(cleanNodeData(d));
      })
      .call(drag(simulation) as any);

    // 3. Tick function updates positions
    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as D3Node).x!)
        .attr("y1", d => (d.source as D3Node).y!)
        .attr("x2", d => (d.target as D3Node).x!)
        .attr("y2", d => (d.target as D3Node).y!);

      node
        .attr("cx", d => d.x!)
        .attr("cy", d => d.y!);
    });

    // Handle click outside nodes/edges to deselect
    svg.on("click", () => onSelect(null));

    // Cleanup function
    return () => {
      simulation.stop();
    };
  }, [graphData, width, height, onSelect, selectedItem]);

  // --- Drag Handlers ---
  const drag = (simulation: d3.Simulation<D3Node, D3Edge>) => {
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
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return d3.drag<SVGCircleElement, D3Node>()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  };

  return (
    <div className="w-full h-full relative">
      <svg ref={svgRef} width="100%" height="100%" className="bg-background/50 rounded-lg"></svg>
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
          <span className={cn("h-4 w-4 rounded-full", getNodeColorClass(item.type))}></span>
          <h4 className="text-lg font-semibold">{item.label}</h4>
          <Badge variant="secondary">{item.type}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">Source Document: {item.source}</p>
        <Separator />
        <h5 className="font-medium text-sm">Attributes:</h5>
        <ScrollArea className="h-24 pr-4">
          {Object.keys(item.attributes).length > 0 ? (
            <ul className="text-sm space-y-1">
              {Object.entries(item.attributes).map(([key, value]) => (
                <li key={key}>
                  <span className="font-mono text-xs text-primary/80">{key}:</span> {String(value)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No specific attributes found.</p>
          )}
        </ScrollArea>
      </div>
    );
  } else {
    // Edge details
    return (
      <div className="p-4 space-y-3">
        <h4 className="text-lg font-semibold">Relationship</h4>
        <p className="text-sm">
          <span className="font-medium text-primary">{item.source}</span> 
          <span className="text-muted-foreground mx-2">--({item.label})--&gt;</span> 
          <span className="font-medium text-primary">{item.target}</span>
        </p>
        <Separator />
        <div className="text-sm space-y-1">
          <p><strong>Relationship Type:</strong> {item.label}</p>
          <p><strong>Score/Weight:</strong> {item.score.toFixed(2)}</p>
          <p><strong>Source Document:</strong> {item.source_file}</p>
        </div>
      </div>
    );
  }
};

export { InteractiveGraphVisualization, DetailPanel };