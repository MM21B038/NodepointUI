"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getKnowledgeGraph, KnowledgeGraphResponse, GraphNode, GraphEdge } from "@/database/workspaceStorage";
import { Loader2, Filter, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface KnowledgeGraphProps {
  workspaceName: string;
}

// Helper function to get unique values for filtering
const getUniqueValues = (data: GraphNode[], key: keyof GraphNode): string[] => {
  const values = data.map(item => String(item[key]));
  return Array.from(new Set(values)).sort();
};

// Simple color mapping for node types (Tailwind classes)
const TYPE_COLORS: Record<string, string> = {
  'Person': 'bg-blue-500 text-white',
  'Organization': 'bg-green-500 text-white',
  'Concept': 'bg-purple-500 text-white',
  'Date': 'bg-yellow-500 text-gray-900',
  'Location': 'bg-red-500 text-white',
  'default': 'bg-gray-400 text-gray-900',
};

const getNodeColorClass = (type: string) => TYPE_COLORS[type] || TYPE_COLORS['default'];

// --- Visualization Component ---

interface SimpleGraphVisualizationProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const SimpleGraphVisualization: React.FC<SimpleGraphVisualizationProps> = ({ nodes, edges }) => {
  const width = 800;
  const height = 400;
  const radius = 150;
  const centerX = width / 2;
  const centerY = height / 2;
  const nodeRadius = 10;

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center w-full h-full text-muted-foreground">
        No nodes match the current filters.
      </div>
    );
  }

  // Calculate positions for nodes in a circular layout
  const positionedNodes = nodes.map((node, index) => {
    const angle = (index / nodes.length) * 2 * Math.PI;
    return {
      ...node,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });

  // Map node IDs to their positions for drawing edges
  const nodeMap = new Map(positionedNodes.map(n => [n.id, n]));

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="border rounded-lg bg-background/50">
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="10"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" className="fill-foreground" />
        </marker>
      </defs>

      {/* Draw Edges */}
      {edges.map((edge, index) => {
        const sourceNode = nodeMap.get(edge.source);
        const targetNode = nodeMap.get(edge.target);

        if (!sourceNode || !targetNode) return null;

        // Calculate line end points adjusted for node radius
        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Normalize vector
        const ux = dx / distance;
        const uy = dy / distance;

        // Adjust target point to stop before the node circle
        const targetX = targetNode.x - ux * nodeRadius;
        const targetY = targetNode.y - uy * nodeRadius;

        return (
          <g key={index}>
            <line
              x1={sourceNode.x}
              y1={sourceNode.y}
              x2={targetX}
              y2={targetY}
              stroke="#94a3b8"
              strokeWidth="1"
              markerEnd="url(#arrowhead)"
            />
            {/* Edge Label (placed near the center of the line) */}
            <text
              x={(sourceNode.x + targetNode.x) / 2}
              y={(sourceNode.y + targetNode.y) / 2}
              fontSize="8"
              fill="#64748b"
              textAnchor="middle"
              className="pointer-events-none"
            >
              {edge.label}
            </text>
          </g>
        );
      })}

      {/* Draw Nodes */}
      {positionedNodes.map((node) => (
        <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
          <circle
            r={nodeRadius}
            className={cn("stroke-2", getNodeColorClass(node.type).replace('bg-', 'fill-').replace('text-', 'stroke-'))}
            stroke="hsl(var(--border))"
          />
          {/* Node Label */}
          <text
            y={nodeRadius + 10}
            fontSize="10"
            textAnchor="middle"
            className="fill-foreground pointer-events-none"
          >
            {node.label.length > 15 ? node.label.substring(0, 12) + '...' : node.label}
          </text>
        </g>
      ))}
    </svg>
  );
};


const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ workspaceName }) => {
  const [graphData, setGraphData] = useState<KnowledgeGraphResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtering state
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    if (!workspaceName) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const data = await getKnowledgeGraph(workspaceName);
      setGraphData(data);
      
      // Initialize filters with all available types and sources upon first load
      const initialTypes = getUniqueValues(data.nodes, 'type');
      const initialSources = getUniqueValues(data.nodes, 'source'); 
      
      setSelectedTypes(new Set(initialTypes));
      setSelectedSources(new Set(initialSources));

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to load knowledge graph.";
      setError(errorMessage);
      toast.error(errorMessage);
      setGraphData(null);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTypeToggle = (type: string, checked: boolean) => {
    setSelectedTypes(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(type);
      } else {
        newSet.delete(type);
      }
      return newSet;
    });
  };

  const handleSourceToggle = (source: string, checked: boolean) => {
    setSelectedSources(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(source);
      } else {
        newSet.delete(source);
      }
      return newSet;
    });
  };

  const uniqueTypes = useMemo(() => {
    return graphData ? getUniqueValues(graphData.nodes, 'type') : [];
  }, [graphData]);

  const uniqueSources = useMemo(() => {
    return graphData ? getUniqueValues(graphData.nodes, 'source') : [];
  }, [graphData]);

  const filteredNodes = useMemo(() => {
    if (!graphData) return [];
    return graphData.nodes.filter(node => 
      selectedTypes.has(node.type) && selectedSources.has(node.source)
    );
  }, [graphData, selectedTypes, selectedSources]);

  const filteredEdges = useMemo(() => {
    if (!graphData) return [];
    const visibleNodeIds = new Set(filteredNodes.map(n => n.id));
    
    // Edges must connect two visible nodes
    return graphData.edges.filter(edge => 
      visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );
  }, [graphData, filteredNodes]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        <p className="text-lg text-muted-foreground">Loading Knowledge Graph...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center p-4">
        <X className="h-10 w-10 text-destructive mb-4" />
        <h3 className="text-xl font-semibold text-destructive">Error Loading Graph</h3>
        <p className="text-muted-foreground mt-2">{error}</p>
        <Button onClick={fetchData} className="mt-4">Try Refreshing</Button>
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center p-4">
        <h3 className="text-xl font-semibold">No Knowledge Graph Data</h3>
        <p className="text-muted-foreground mt-2">
          No entities or relationships found for workspace "{workspaceName}". Ensure documents have been uploaded and processed.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[70vh] space-x-4">
      {/* Left Sidebar: Filters */}
      <Card className="w-64 flex-shrink-0 overflow-y-auto">
        <CardHeader className="p-4 border-b">
          <CardTitle className="text-lg flex items-center">
            <Filter className="h-4 w-4 mr-2" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-6">
          
          {/* Node Type Filter */}
          <div>
            <h4 className="font-semibold mb-2 text-sm">Node Type ({uniqueTypes.length})</h4>
            <div className="space-y-2">
              {uniqueTypes.map(type => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox
                    id={`type-${type}`}
                    checked={selectedTypes.has(type)}
                    onCheckedChange={(checked) => handleTypeToggle(type, Boolean(checked))}
                  />
                  <Label htmlFor={`type-${type}`} className="flex items-center text-sm font-normal cursor-pointer">
                    <span className={cn("h-3 w-3 rounded-full mr-2", getNodeColorClass(type))}></span>
                    {type}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Source Filter */}
          <div>
            <h4 className="font-semibold mb-2 text-sm">Source Document ({uniqueSources.length})</h4>
            <ScrollArea className="h-32 pr-4">
              <div className="space-y-2">
                {uniqueSources.map(source => (
                  <div key={source} className="flex items-center space-x-2">
                    <Checkbox
                      id={`source-${source}`}
                      checked={selectedSources.has(source)}
                      onCheckedChange={(checked) => handleSourceToggle(source, Boolean(checked))}
                    />
                    <Label htmlFor={`source-${source}`} className="text-sm font-normal cursor-pointer max-w-[150px] truncate">
                      {source}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      {/* Right Content: Visualization and Summary */}
      <div className="flex-grow flex flex-col space-y-4">
        <Card>
          <CardHeader className="p-4 border-b">
            <CardTitle className="text-lg">
              Knowledge Graph Visualization
            </CardTitle>
            <div className="text-sm text-muted-foreground">
              Showing {filteredNodes.length} nodes and {filteredEdges.length} edges (Total: {graphData.nodes.length} nodes, {graphData.edges.length} edges)
            </div>
          </CardHeader>
          <CardContent className="p-4 h-[50vh] flex items-center justify-center bg-gray-50 dark:bg-gray-900/50 rounded-b-lg">
            <SimpleGraphVisualization nodes={filteredNodes} edges={filteredEdges} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default KnowledgeGraph;