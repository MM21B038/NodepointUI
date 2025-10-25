"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getKnowledgeGraph, KnowledgeGraphResponse, GraphNode, GraphEdge } from "@/database/workspaceStorage";
import { Loader2, Filter, X, RefreshCw, Info } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { InteractiveGraphVisualization, DetailPanel } from "@/components/InteractiveGraphVisualization";
import { useWorkspace } from "@/context/WorkspaceContext";

// Helper function to get unique values for filtering
const getUniqueValues = (data: GraphNode[], key: keyof GraphNode): string[] => {
  const values = data.map(item => String(item[key]));
  return Array.from(new Set(values)).sort();
};

// Simple color mapping for node types (Tailwind classes)
const TYPE_COLORS: Record<string, string> = {
  'Person': 'bg-blue-500',
  'Organization': 'bg-green-500',
  'Concept': 'bg-purple-500',
  'Date': 'bg-yellow-500',
  'Location': 'bg-red-500',
};

const getNodeColorClass = (type: string) => TYPE_COLORS[type] || 'bg-gray-400';

const KnowledgeBase = () => {
  const { currentWorkspace } = useWorkspace();
  
  const [graphData, setGraphData] = useState<KnowledgeGraphResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<GraphNode | GraphEdge | null>(null);
  
  // Filtering state
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    if (!currentWorkspace) {
      setIsLoading(false);
      setGraphData(null);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSelectedItem(null);
    try {
      const data = await getKnowledgeGraph(currentWorkspace);
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
  }, [currentWorkspace]);

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

  // --- Render States ---

  if (!currentWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <h3 className="text-2xl font-semibold mb-2">No Workspace Selected</h3>
        <p className="text-muted-foreground">
          Please select a workspace using the selector in the navigation bar.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        <p className="text-lg text-muted-foreground">Loading Knowledge Graph for {currentWorkspace}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <X className="h-10 w-10 text-destructive mb-4" />
        <h3 className="text-xl font-semibold text-destructive">Error Loading Graph</h3>
        <p className="text-muted-foreground mt-2">{error}</p>
        <Button onClick={fetchData} className="mt-4">Try Refreshing</Button>
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <h3 className="text-xl font-semibold">No Knowledge Graph Data</h3>
        <p className="text-muted-foreground mt-2">
          No entities or relationships found for workspace "{currentWorkspace}". Ensure documents have been uploaded and processed.
        </p>
      </div>
    );
  }

  // --- Main Visualization Layout (Full Screen Canvas with Floating Panels) ---
  return (
    <div className="relative h-full w-full">
      
      {/* 1. Visualization Canvas (Background) */}
      <div className="absolute inset-0">
        <InteractiveGraphVisualization 
          nodes={filteredNodes} 
          edges={filteredEdges} 
          onSelect={setSelectedItem}
          selectedItem={selectedItem}
        />
      </div>

      {/* 2. Top Bar (Floating) */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-b z-20">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            Knowledge Graph: <span className="text-primary">{currentWorkspace}</span>
          </h2>
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <span>
              Showing {filteredNodes.length} nodes and {filteredEdges.length} edges (Total: {graphData.nodes.length} nodes, {graphData.edges.length} edges)
            </span>
            <Button variant="outline" size="icon" onClick={fetchData} disabled={isLoading}>
              <RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            </Button>
          </div>
        </div>
      </div>

      {/* 3. Left Panel: Filters (Floating) */}
      <Card className="absolute top-20 bottom-4 left-4 w-40 flex flex-col z-20 shadow-xl">
        <CardHeader className="p-4 border-b flex-shrink-0">
          <CardTitle className="text-lg flex items-center">
            <Filter className="h-4 w-4 mr-2" /> Filters
          </CardTitle>
        </CardHeader>
        <ScrollArea className="flex-grow">
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
            </div>
          </CardContent>
        </ScrollArea>
      </Card>

      {/* 4. Right Panel: Details (Floating) */}
      <Card className="absolute top-20 bottom-4 right-4 w-80 flex flex-col z-20 shadow-xl">
        <CardHeader className="p-4 border-b flex-shrink-0">
          <CardTitle className="text-lg flex items-center">
            <Info className="h-4 w-4 mr-2" /> Details
          </CardTitle>
        </CardHeader>
        <ScrollArea className="flex-grow">
          <CardContent className="p-0">
            <DetailPanel item={selectedItem} />
          </CardContent>
        </ScrollArea>
      </Card>
    </div>
  );
};

export default KnowledgeBase;