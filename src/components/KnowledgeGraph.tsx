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

interface KnowledgeGraphProps {
  workspaceName: string;
}

// Helper function to get unique values for filtering
const getUniqueValues = (data: GraphNode[], key: keyof GraphNode): string[] => {
  const values = data.map(item => String(item[key]));
  return Array.from(new Set(values)).sort();
};

// Simple color mapping for node types
const TYPE_COLORS: Record<string, string> = {
  'Person': 'bg-blue-500',
  'Organization': 'bg-green-500',
  'Concept': 'bg-purple-500',
  'Date': 'bg-yellow-500',
  'Location': 'bg-red-500',
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
      console.log("KnowledgeGraph: Workspace name is missing, skipping fetch.");
      setIsLoading(false);
      return;
    }
    console.log(`KnowledgeGraph: Fetching data for workspace: ${workspaceName}`);
    
    setIsLoading(true);
    setError(null);
    try {
      const data = await getKnowledgeGraph(workspaceName);
      setGraphData(data);
      
      // Initialize filters with all available types and sources upon first load
      const initialTypes = getUniqueValues(data.nodes, 'type');
      // Use 'source' field from GraphNode for filtering
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
                    <span className={`h-3 w-3 rounded-full mr-2 ${TYPE_COLORS[type] || 'bg-gray-400'}`}></span>
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
              Showing {filteredNodes.length} nodes and {filteredEdges.length} edges (Total: {graphData?.nodes.length || 0} nodes, {graphData?.edges.length || 0} edges)
            </div>
          </CardHeader>
          <CardContent className="p-4 h-[50vh] flex items-center justify-center bg-gray-50 dark:bg-gray-900/50 rounded-b-lg">
            {/* Placeholder for actual Graph Visualization */}
            <div className="text-center text-muted-foreground">
              <p className="mb-2">Interactive Graph Visualization Area</p>
              <p className="text-sm">
                (Integration with a library like D3 or Vis.js would go here)
              </p>
              <div className="mt-4 space-y-2 text-left max-w-md mx-auto p-4 border rounded-lg bg-white dark:bg-card">
                <h5 className="font-semibold">Filtered Nodes Preview:</h5>
                <ScrollArea className="h-24">
                  {filteredNodes.slice(0, 10).map(node => (
                    <div key={node.id} className="flex justify-between text-xs py-0.5">
                      <span className="truncate">{node.label}</span>
                      <Badge variant="secondary" className={`h-4 ${TYPE_COLORS[node.type] || 'bg-gray-400'}`}>{node.type}</Badge>
                    </div>
                  ))}
                  {filteredNodes.length > 10 && <p className="text-xs text-center mt-1">...and {filteredNodes.length - 10} more</p>}
                </ScrollArea>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default KnowledgeGraph;