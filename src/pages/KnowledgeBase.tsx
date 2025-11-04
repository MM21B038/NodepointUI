"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getKnowledgeGraph, KnowledgeGraphResponse, GraphNode, GraphEdge } from "@/database/workspaceStorage";
import { Loader2, Filter, X, RefreshCw, Info, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { InteractiveGraphVisualization, DetailPanel, getNodeColorClass } from "../components/InteractiveGraphVisualization"; // Corrected import path
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty, CommandGroup } from "@/components/ui/command";
import { 
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

interface KnowledgeGraphProps {
  workspaceName: string;
}

// Helper function to get unique values for filtering
const getUniqueValues = (data: GraphNode[], key: keyof GraphNode): string[] => {
  const values = data.map(item => String(item[key]));
  return Array.from(new Set(values)).sort();
};

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ workspaceName }) => {
  const [graphData, setGraphData] = useState<KnowledgeGraphResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<GraphNode | GraphEdge | null>(null);
  
  // State to control the detail sidebar's open/close status
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(true); // Start open by default

  // Filtering state
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [sourceSearchTerm, setSourceSearchTerm] = useState("");

  const fetchData = useCallback(async () => {
    if (!workspaceName) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSelectedItem(null); // Clear selected item on refresh
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

  // When an item is selected, ensure the detail panel is open
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
    
    // Edges must connect two visible nodes
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
          No entities or relationships found for workspace "{workspaceName}". Ensure documents have been uploaded and processed.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <h1 className="text-3xl font-bold p-4 pb-0">Knowledge Base: {workspaceName}</h1>
      <div className="flex-grow min-h-0 px-4 pb-4">
        <ResizablePanelGroup
          direction="horizontal"
          className="min-h-[calc(100vh-120px)] rounded-xl border shadow-lg bg-card"
        >
          <ResizablePanel defaultSize={75} minSize={50}>
            <div className="relative h-full w-full">
              <InteractiveGraphVisualization 
                nodes={filteredNodes} 
                edges={filteredEdges} 
                onSelect={setSelectedItem}
                selectedItem={selectedItem}
              />
              
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

              {/* Main Filter Popover (Overlay) */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="absolute top-4 left-4 z-10 shadow-lg flex items-center gap-2"
                  >
                    <Filter className="h-4 w-4" />
                    Filter
                    {filterSummary && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        ({filterSummary})
                      </span>
                    )}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-4 space-y-6">
                  {/* Node Type Filter Section */}
                  <div>
                    <h4 className="font-semibold mb-2 text-sm">Node Type ({selectedTypes.size}/{uniqueTypes.length})</h4>
                    <div className="flex space-x-2 mb-3">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSelectedTypes(new Set(uniqueTypes))}
                        disabled={selectedTypes.size === uniqueTypes.length}
                      >
                        Select All
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSelectedTypes(new Set())}
                        disabled={selectedTypes.size === 0}
                      >
                        Clear All
                      </Button>
                    </div>
                    <Popover> {/* Nested Popover for Node Types */}
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          {selectedTypes.size === uniqueTypes.length ? "All Types" : `${selectedTypes.size} Type(s) Selected`}
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-0">
                        <Command>
                          <CommandInput placeholder="Search types..." />
                          <CommandList>
                            <CommandEmpty>No types found.</CommandEmpty>
                            <CommandGroup>
                              {uniqueTypes.map(type => (
                                <CommandItem key={type} className="p-0">
                                  <Label 
                                    htmlFor={`type-${type}`} 
                                    className="flex items-center space-x-2 p-2 w-full cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm"
                                  >
                                    <Checkbox
                                      id={`type-${type}`}
                                      checked={selectedTypes.has(type)}
                                      onCheckedChange={(checked) => handleTypeToggle(type, Boolean(checked))}
                                    />
                                    <span className={cn("h-3 w-3 rounded-full", getNodeColorClass(type))}></span>
                                    <span className="text-sm font-normal flex-1">{type}</span>
                                  </Label>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <Separator />

                  {/* Source Document Filter Section */}
                  <div>
                    <h4 className="font-semibold mb-2 text-sm">Source Document ({selectedSources.size}/{uniqueSources.length})</h4>
                    <div className="flex space-x-2 mb-3">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSelectedSources(new Set(uniqueSources))}
                        disabled={selectedSources.size === uniqueSources.length}
                      >
                        Select All
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSelectedSources(new Set())}
                        disabled={selectedSources.size === 0}
                      >
                        Clear All
                      </Button>
                    </div>
                    <Input
                      placeholder="Search source documents..."
                      value={sourceSearchTerm}
                      onChange={(e) => setSourceSearchTerm(e.target.value)}
                      className="mb-3"
                    />
                    <ScrollArea className="h-48 border rounded-md p-2">
                      <div className="space-y-2">
                        {filteredUniqueSources.length === 0 && (
                          <p className="text-muted-foreground text-sm text-center py-4">No matching sources.</p>
                        )}
                        {filteredUniqueSources.map(source => (
                          <div key={source} className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent/50">
                            <Checkbox
                              id={`source-${source}`}
                              checked={selectedSources.has(source)}
                              onCheckedChange={(checked) => handleSourceToggle(source, Boolean(checked))}
                            />
                            <Label htmlFor={`source-${source}`} className="text-sm font-normal cursor-pointer flex-1 max-w-[calc(100%-2rem)] truncate">
                              {source}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel 
            defaultSize={25} 
            minSize={15} 
            collapsed={!isDetailPanelOpen} 
            onCollapse={(collapsed) => setIsDetailPanelOpen(!collapsed)}
            className="transition-all duration-300 ease-in-out"
          >
            <Card className="h-full border-none shadow-none rounded-none flex flex-col">
              <CardHeader className="pb-2 px-4 pt-4 flex flex-row items-center justify-between">
                {isDetailPanelOpen && <CardTitle className="text-lg font-semibold">Details</CardTitle>}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsDetailPanelOpen(!isDetailPanelOpen)}
                  className={cn("ml-auto", !isDetailPanelOpen && "mx-auto")}
                >
                  {isDetailPanelOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
              </CardHeader>
              {isDetailPanelOpen && (
                <CardContent className="flex-grow p-0 h-[calc(100%-60px)]">
                  <ScrollArea className="h-full">
                    <DetailPanel item={selectedItem} />
                  </ScrollArea>
                </CardContent>
              )}
            </Card>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default KnowledgeGraph;