"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getKnowledgeGraph, KnowledgeGraphResponse, GraphNode, GraphEdge } from "@/database/workspaceStorage";
import { Loader2, Filter, X, RefreshCw, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { InteractiveGraphVisualization, DetailPanel } from "./InteractiveGraphVisualization";

interface KnowledgeGraphProps {
  workspaceName: string;
}

// Helper function to get unique values for filtering
const getUniqueValues = (data: GraphNode[], key: keyof GraphNode): string[] => {
  const values = data.map(item => String(item[key]));
  return Array.from(new Set(values)).sort();
};

// Simple color mapping for node types (Tailwind classes) - KEPT FOR VISUALIZATION/DETAIL PANEL
const TYPE_COLORS: Record<string, string> = {
  'Person': 'bg-blue-500',
  'Organization': 'bg-green-500',
  'Concept': 'bg-purple-500',
  'Date': 'bg-yellow-500',
  'Location': 'bg-red-500',
};

// Utility function to get the color class (used by visualization and detail panel)
const getNodeColorClass = (type: string) => TYPE_COLORS[type] || 'bg-gray-400';


const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ workspaceName }) => {
  const [graphData, setGraphData] = useState<KnowledgeGraphResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<GraphNode | GraphEdge | null>(null);
  
  // Overlay state
  const [isFilterOpen, setIsFilterOpen] = useState(true);
  const [isDetailOpen, setIsDetailOpen] = useState(true);

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
    setSelectedItem(null);
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
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        <p className="text-lg text-muted-foreground">Loading Knowledge Graph...</p>
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
          No entities or relationships found for workspace "{workspaceName}". Ensure documents have been uploaded and processed.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {/* Graph Visualization (Z-index lower) */}
      <div className="absolute inset-0 z-0">
        <InteractiveGraphVisualization 
          nodes={filteredNodes} 
          edges={filteredEdges} 
          onSelect={setSelectedItem}
          selectedItem={selectedItem}
        />
      </div>
      
      {/* Refresh Button (Top Center Overlay) */}
      <Button 
        variant="outline" 
        size="icon" 
        onClick={fetchData} 
        disabled={isLoading}
        className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 shadow-lg"
      >
        <RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
      </Button>

      {/* Left Filter Panel (Overlay) */}
      <div 
        className={cn(
          "absolute top-4 left-4 z-10 w-48 transition-all duration-300 overflow-hidden",
          "bg-card border rounded-lg shadow-xl flex flex-col",
          // Symmetric height: 100% - (16px top + 16px bottom) = 100% - 2rem
          isFilterOpen ? "h-[calc(100%-2rem)]" : "h-12" // Collapsed height increased to h-12 (48px)
        )}
      >
        <div className="flex items-center justify-between p-3 border-b flex-shrink-0"> {/* Increased padding to p-3 */}
          {/* Ensure title is always visible */}
          <h3 className="text-lg font-semibold flex items-center">
            <Filter className="h-4 w-4 mr-2" /> Filters
          </h3>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="flex-shrink-0"
          >
            {/* ChevronUp/Down for vertical collapse */}
            {isFilterOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
        
        {/* Content area only visible when open */}
        {isFilterOpen && (
          <ScrollArea className="flex-grow p-4 space-y-6">
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
                    <Label htmlFor={`type-${type}`} className="text-sm font-normal cursor-pointer">
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
          </ScrollArea>
        )}
      </div>

      {/* Right Detail Panel (Overlay) */}
      <div 
        className={cn(
          "absolute top-4 right-4 z-10 transition-all duration-300 overflow-hidden",
          "bg-card border rounded-lg shadow-xl flex flex-col",
          // Symmetric height: 100% - (16px top + 16px bottom) = 100% - 2rem
          isDetailOpen ? "w-72 h-[calc(100%-2rem)]" : "w-10 h-[calc(100%-2rem)]"
        )}
      >
        <div className="flex items-center justify-between p-3 border-b flex-shrink-0"> {/* Increased padding to p-3 */}
          {/* Toggle button on the left */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsDetailOpen(!isDetailOpen)}
            className="flex-shrink-0"
          >
            {/* ChevronRight when open (collapses right-to-left), ChevronLeft when closed (expands left-to-right) */}
            {isDetailOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
          <div className="flex-grow text-right">
            {isDetailOpen && <h3 className="text-lg font-semibold">Details</h3>}
          </div>
        </div>
        
        {isDetailOpen && (
          <ScrollArea className="overflow-y-auto flex-grow">
            <DetailPanel item={selectedItem} />
          </ScrollArea>
        )}
      </div>
    </div>
  );
};

export default KnowledgeGraph;