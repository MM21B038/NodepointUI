"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { GraphNode, GraphEdge } from "@/database/workspaceStorage";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CircleDot, Link, FileText, Hash, Info } from "lucide-react";

// --- Color Mapping for React Components (DetailPanel & Filters) ---
// This is kept simple for Tailwind classes in the React UI
const TYPE_COLORS: Record<string, string> = {
  'Person': 'bg-blue-500',
  'Organization': 'bg-green-500',
  'Concept': 'bg-purple-500',
  'Date': 'bg-yellow-500',
  'Location': 'bg-red-500',
  'default': 'bg-gray-400',
};

export const getNodeColorClass = (type: string) => TYPE_COLORS[type] || TYPE_COLORS['default'];

// --- D3 Color Scale for Visualization ---
// Using d3.schemeSet3 which provides 12 bright, distinct colors.
const colorScale = d3.scaleOrdinal(d3.schemeSet3);

// Function to get D3 colors based on node type
const getNodeD3Colors = (type: string) => {
  const fill = colorScale(type);
  // Calculate a darker stroke color for contrast
  // Using darker(1.8) to ensure a strong, defined boundary
  const stroke = d3.color(fill)?.darker(1.8).toString() || '#000000';
  return { fill, stroke };
};


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

    // --- D3 Force Simulation ---
    const simulation = d3.forceSimulation<D3Node, D3Edge>(graphData.nodes)
      .force("link", d3.forceLink<D3Node, D3Edge>(graphData.edges).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX(width / 2).strength(0.05))
      .force("y", d3.forceY(height / 2).strength(0.05));

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
        simulation.stop(); // Stop simulation on click
      })
      .attr("class", d => cn(
        "cursor-pointer transition-all",
        selectedItem && 'source_file' in selectedItem && selectedItem.source_file === d.source_file ? "stroke-primary" : "hover:stroke-primary/80"
      ));

    // 2. Nodes
    const node = g.append("g")
      .attr("stroke-width", 3) // Increased stroke width for better visibility
      .selectAll("circle")
      .data(graphData.nodes)
      .join("circle")
      .attr("r", 10)
      .attr("fill", d => getNodeD3Colors(d.type).fill) // Use dynamic fill color
      .attr("stroke", d => getNodeD3Colors(d.type).stroke) // Use dynamic darker stroke color
      .attr("class", d => cn(
        "cursor-pointer transition-all",
        selectedItem && 'id' in selectedItem && selectedItem.id === d.id ? "ring-4 ring-offset-2 ring-primary" : "hover:ring-2 hover:ring-primary/50"
      ))
      .on("click", (event, d) => {
        event.stopPropagation();
        onSelect(cleanNodeData(d));
        simulation.stop(); // Stop simulation on click
      })
      .call(drag(simulation) as any);

    // 3. Labels
    const label = g.append("g")
      .attr("class", "labels")
      .selectAll("text")
      .data(graphData.nodes)
      .join("text")
      .text(d => d.label)
      .attr("pointer-events", "none") // Don't interfere with node clicks
      .attr("text-anchor", "middle")
      .attr("dy", "1.5em") // Position below the circle
      .attr("fill", "hsl(var(--foreground))")
      .attr("class", "select-none opacity-0"); // Initial opacity 0

    // 4. Zoom functionality (Unlimited zoom and label scaling)
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 100]) // Virtually unlimited zoom
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        
        const k = event.transform.k;
        const baseFontSize = 8;
        
        // Scale text inversely to maintain screen size appearance
        label.attr("font-size", `${baseFontSize / k}px`);
        
        // Control visibility: show labels only when zoomed in past a threshold (k > 0.8)
        label.attr("opacity", k > 0.8 ? 1 : 0);
      });
    svg.call(zoom as any);


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
        
      label
        .attr("x", d => d.x!)
        .attr("y", d => d.y!);
    });

    // Handle click outside nodes/edges to deselect and restart simulation
    svg.on("click", () => {
      onSelect(null);
      // Restart simulation briefly to settle if needed, but only if it was stopped
      if (!simulation.running) {
        simulation.alpha(1).restart();
      }
    });
    
    // Ensure simulation starts when data changes
    simulation.alpha(1).restart();


    // Cleanup function
    return () => {
      simulation.stop();
    };
  }, [graphData, width, height, onSelect]); 

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
      // Keep the node fixed after dragging until the user clicks away
      // d.fx = null;
      // d.fy = null;
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
      <div className="text-muted-foreground p-4 text-center">
        <Info className="h-6 w-6 mx-auto mb-2 text-muted" />
        <p>Click on a node or edge in the graph to see its details here.</p>
      </div>
    );
  }

  if ('type' in item) {
    // Node details
    return (
      <div className="p-4"> {/* Removed outer Card, added padding */}
        <CardHeader className="pb-2 px-0 pt-0"> {/* Adjusted padding */}
          <CardTitle className="flex items-center text-xl">
            <CircleDot className="h-5 w-5 mr-2 text-primary" />
            <span className="break-words flex-1 min-w-0">{item.label}</span>
          </CardTitle>
          <div className="flex items-center space-x-2 mt-2">
            <span className={cn("h-4 w-4 rounded-full", getNodeColorClass(item.type))}></span>
            <Badge variant="secondary" className="text-sm font-medium">{item.type}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-0 pb-0"> {/* Adjusted padding */}
          <div>
            <h5 className="font-semibold text-sm flex items-center text-muted-foreground mb-1">
              <FileText className="h-4 w-4 mr-1" /> Source Document
            </h5>
            <p className="text-sm text-foreground break-all bg-secondary/50 p-2 rounded-md">
              {item.source}
            </p>
          </div>
          <Separator />
          <div>
            <h5 className="font-semibold text-sm flex items-center text-muted-foreground mb-1">
              <Hash className="h-4 w-4 mr-1" /> Attributes
            </h5>
            <div className="border rounded-md p-3 bg-secondary/50">
              {Object.keys(item.attributes).length > 0 ? (
                <div className="grid grid-cols-1 gap-y-2">
                  {Object.entries(item.attributes).map(([key, value]) => (
                    <div key={key} className="flex flex-col">
                      <span className="font-semibold text-sm text-muted-foreground">{key}:</span> 
                      <span className="text-foreground text-sm break-words">{String(value)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No specific attributes found.</p>
              )}
            </div>
          </div>
        </CardContent>
      </div>
    );
  } else {
    // Edge details
    return (
      <div className="p-4"> {/* Removed outer Card, added padding */}
        <CardHeader className="pb-2 px-0 pt-0"> {/* Adjusted padding */}
          <CardTitle className="flex items-center text-xl">
            <Link className="h-5 w-5 mr-2 text-primary" />
            Relationship
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-0 pb-0"> {/* Adjusted padding */}
          <div>
            <h5 className="font-semibold text-sm flex items-center text-muted-foreground mb-1">
              <Info className="h-4 w-4 mr-1" /> Relationship Path
            </h5>
            <p className="text-sm break-words bg-secondary/50 p-2 rounded-md">
              <span className="font-medium text-primary">{item.source}</span> 
              <span className="text-muted-foreground mx-2">--({item.label})--&gt;</span> 
              <span className="font-medium text-primary">{item.target}</span>
            </p>
          </div>
          <Separator />
          <div className="space-y-2 text-sm">
            <div>
              <h5 className="font-semibold text-sm flex items-center text-muted-foreground mb-1">
                <Hash className="h-4 w-4 mr-1" /> Type
              </h5>
              <p className="bg-secondary/50 p-2 rounded-md break-words">{item.label}</p>
            </div>
            <div>
              <h5 className="font-semibold text-sm flex items-center text-muted-foreground mb-1">
                <Info className="h-4 w-4 mr-1" /> Score/Weight
              </h5>
              <p className="bg-secondary/50 p-2 rounded-md">{item.score.toFixed(2)}</p>
            </div>
            <div>
              <h5 className="font-semibold text-sm flex items-center text-muted-foreground mb-1">
                <FileText className="h-4 w-4 mr-1" /> Source Document
              </h5>
              <p className="bg-secondary/50 p-2 rounded-md break-all">{item.source_file}</p>
            </div>
          </div>
        </CardContent>
      </div>
    );
  }
};

export { InteractiveGraphVisualization, DetailPanel };