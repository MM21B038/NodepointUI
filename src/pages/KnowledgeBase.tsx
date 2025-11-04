"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getKnowledgeGraph, KnowledgeGraphResponse, GraphNode, GraphEdge } from "@/database/workspaceStorage";
import { Loader2, Filter, X, RefreshCw, Info, ChevronDown, ChevronLeft, ChevronRight, BookOpenText } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { InteractiveGraphVisualization, DetailPanel, getNodeColorClass } from "../components/InteractiveGraphVisualization";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty, CommandGroup } from "@/components/ui/command";
import { 
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useWorkspace } from "@/context/WorkspaceContext";

const getUniqueValues = (data: GraphNode[], key: keyof GraphNode): string[] => {
  const values = data.map(item => String(item[key]));
  return Array.from(new Set(values)).sort();
};

const KnowledgeGraph: React.FC = () => {
  const { currentWorkspace } = useWorkspace();
  
  const [graphData, setGraphData] = useState<KnowledgeGraphResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<GraphNode | GraphEdge | null>(null);
  
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(true);

  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [sourceSearchTerm, setSourceSearchTerm] = useState("");

  const fetchData = useCallback(async () => {
    console.log("Fetching knowledge graph for workspace:", currentWorkspace);
    if (!currentWorkspace) {
      setIsLoading(false);
      setGraphData(null);
      setError("No workspace selected.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSelectedItem(null);
    try {
      const data = await getKnowledgeGraph(currentWorkspace);
      console.log("Knowledge graph data received:", data);
      setGraphData(data);
      
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

  useEffect(() => {
    if (selectedItem && !isDetailPanelOpen) {
      setIsDetailPanelOpen(true);
    }
  }, [selectedItem, isDetailPanelOpen]);

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
    
    return graphData.edges.filter(edge => 
      visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );
  }, [graphData, filteredNodes]);

  const filteredUniqueSources = useMemo(() => {
    return uniqueSources.filter(source => 
      source.toLowerCase().includes(sourceSearchTerm.toLowerCase())
    );
  }, [uniqueSources, sourceSearchTerm]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedTypes.size > 0 && selectedTypes.size < uniqueTypes.length) {
      count++;
    }
    if (selectedSources.size > 0 && selectedSources.size < uniqueSources.length) {
      count++;
    }
    return count;
  }, [selectedTypes, uniqueTypes, selectedSources, uniqueSources]);

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (selectedTypes.size > 0 && selectedTypes.size < uniqueTypes.length) {
      parts.push(`${selectedTypes.size} type${selectedTypes.size > 1 ? 's' : ''}`);
    }
    if (selectedSources.size > 0 && selectedSources.size < uniqueSources.length) {
      parts.push(`${selectedSources.size} source${selectedSources.size > 1 ? 's' : ''}`);
    }
    return parts.join(', ');
  }, [selectedTypes, uniqueTypes, selectedSources, uniqueSources]);


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
          No entities or relationships found for workspace "{currentWorkspace}". Ensure documents have been uploaded and processed.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4">
      <h1 className="text-3xl font-bold pb-4 flex items-center">
        <BookOpenText className="h-7 w-7 mr-3 text-primary" />
        Knowledge Base: {currentWorkspace}
      </h1>
      <div className="flex-grow min-h-0 border rounded-xl shadow-lg bg-card flex items-center justify-center">
        <p className="text-muted-foreground">Graph visualization will go here.</p>
      </div>
    </div>
  );
};

export default KnowledgeGraph;