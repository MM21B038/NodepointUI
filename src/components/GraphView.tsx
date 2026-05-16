"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Loader2, Filter, RefreshCw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { InteractiveGraphVisualization, colorScale } from "./InteractiveGraphVisualization";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty, CommandGroup } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GraphNode, GraphEdge, KnowledgeGraphResponse } from "@/database/workspaceStorage";

interface GraphViewProps {
  graphData: KnowledgeGraphResponse | null;
  isLoading: boolean;
  fetchData: () => void;
  selectedItem: GraphNode | null;
  onSelect: (item: GraphNode | null) => void;
}

// Helper function to get unique values for filtering
const getUniqueValues = (data: GraphNode[], key: keyof GraphNode): string[] => {
  const values = data.map(item => String(item[key]));
  return Array.from(new Set(values)).sort();
};

const GraphView: React.FC<GraphViewProps> = ({
  graphData,
  isLoading,
  fetchData,
  selectedItem,
  onSelect,
}) => {
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [sourceSearchTerm, setSourceSearchTerm] = useState("");

  // Initialize filters with all available types and sources when graphData changes
  useEffect(() => {
    if (graphData) {
      const initialTypes = getUniqueValues(graphData.nodes, 'type');
      const initialSources = getUniqueValues(graphData.nodes, 'source'); 
      setSelectedTypes(new Set(initialTypes));
      setSelectedSources(new Set(initialSources));
    }
  }, [graphData]);

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

  return (
    <div className="relative h-full w-full">
      <InteractiveGraphVisualization
        nodes={filteredNodes}
        edges={filteredEdges}
        onSelect={onSelect}
        selectedItem={selectedItem}
        onGraphBackgroundClick={() => {}}
        showControls={false}
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
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: colorScale(type) }}
                            />
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
  );
};

export default GraphView;