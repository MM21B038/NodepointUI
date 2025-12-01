"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { BookOpen, Info, RefreshCw, Loader2, Search, Network, FileText, X, Filter, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { InteractiveGraphVisualization, getNodeColorClass } from "@/components/InteractiveGraphVisualization";
import DetailPanel from "@/components/DetailPanel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getKnowledgeGraph, GraphNode, GraphEdge, FileReference } from "@/database/workspaceStorage";
import { showError } from "@/utils/toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty, CommandGroup } from "@/components/ui/command";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const KnowledgeBase = () => {
  console.log("KnowledgeBase: Component rendered.");
  const { currentWorkspace } = useWorkspace();
  const [allNodes, setAllNodes] = useState<GraphNode[]>([]);
  const [allEdges, setAllEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<GraphNode | GraphEdge | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // State to control the detail sidebar's open/close status
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(true); // Start open by default

  // State for filter values
  const [nodeSearchQuery, setNodeSearchQuery] = useState<string>("");
  const [searchDepth, setSearchDepth] = useState<number>(0);
  const [selectedNodeTypes, setSelectedNodeTypes] = useState<Set<string>>(new Set());
  const [selectedSourceFiles, setSelectedSourceFiles] = useState<Set<string>>(new Set());

  // New state to track if filters have been interacted with
  const [hasFiltersBeenInteracted, setHasFiltersBeenInteracted] = useState(false);

  const onFilterInteraction = useCallback(() => {
    setHasFiltersBeenInteracted(true);
  }, []);

  const fetchGraphData = useCallback(async (workspaceName: string) => {
    console.log(`KnowledgeBase: fetchGraphData called for workspace: ${workspaceName}`);
    setLoading(true);
    setError(null);
    setAllNodes([]);
    setAllEdges([]);
    setHasFiltersBeenInteracted(false); // Reset interaction state on new data fetch
    try {
      const data = await getKnowledgeGraph(workspaceName);
      console.log("KnowledgeBase: fetchGraphData - API call successful.", data);

      const rawNodes = data.nodes || [];
      const rawEdges = data.edges || [];

      const processedNodes: GraphNode[] = rawNodes;
      const nodeIds = new Set(processedNodes.map(node => node.id));

      const processedEdges: GraphEdge[] = rawEdges.filter(edge =>
        nodeIds.has(edge.source as string) && nodeIds.has(edge.target as string)
      );

      setAllNodes(processedNodes);
      setAllEdges(processedEdges);
      
      // On initial load or refresh, if there are nodes, select all by default
      if (processedNodes.length > 0) {
        setSelectedNodeTypes(new Set(processedNodes.map(node => node.type)));
        
        const allFileSources = new Set<string>();
        processedNodes.forEach(node => node.source.forEach(s => allFileSources.add(s)));
        processedEdges.forEach(edge => edge.source_file.forEach(s => allFileSources.add(s)));
        setSelectedSourceFiles(allFileSources);

      } else {
        setSelectedNodeTypes(new Set());
        setSelectedSourceFiles(new Set());
      }
      setNodeSearchQuery(""); // Clear search query on refresh
      setSearchDepth(0); // Reset search depth on refresh
      console.log(`KnowledgeBase: fetchGraphData - Processed ${processedNodes.length} nodes and ${processedEdges.length} edges.`);
    } catch (err: any) {
      console.error("KnowledgeBase: fetchGraphData - Error fetching knowledge graph:", err);
      setError("Failed to load knowledge graph. Please ensure preprocessing is complete and try again.");
      showError("Failed to load knowledge graph.");
    } finally {
      setLoading(false);
      console.log("KnowledgeBase: fetchGraphData - Finished.");
    }
  }, []);

  useEffect(() => {
    console.log(`KnowledgeBase: useEffect triggered. currentWorkspace: ${currentWorkspace}, refreshCounter: ${refreshCounter}`);
    if (currentWorkspace) {
      fetchGraphData(currentWorkspace);
    } else {
      console.log("KnowledgeBase: No current workspace selected. Clearing graph data.");
      setAllNodes([]);
      setAllEdges([]);
      setLoading(false);
      setError(null);
      setSelectedItem(null);
      setHasFiltersBeenInteracted(false);
      setNodeSearchQuery("");
      setSearchDepth(0);
      setSelectedNodeTypes(new Set());
      setSelectedSourceFiles(new Set());
    }
  }, [currentWorkspace, refreshCounter, fetchGraphData]);

  // When an item is selected, ensure the detail panel is open
  useEffect(() => {
    if (selectedItem && !isDetailPanelOpen) {
      setIsDetailPanelOpen(true);
    }
  }, [selectedItem, isDetailPanelOpen]);

  const handleRefreshGraph = () => {
    console.log("KnowledgeBase: handleRefreshGraph called.");
    setRefreshCounter(prev => prev + 1);
  };

  // Helper function to get unique values for filtering
  const getUniqueValues = (data: GraphNode[], key: keyof GraphNode): string[] => {
    const values = data.flatMap(item => {
      const val = item[key];
      return Array.isArray(val) ? val.map(String) : [String(val)];
    });
    return Array.from(new Set(values)).sort();
  };

  const handleTypeToggle = (type: string, checked: boolean) => {
    setSelectedNodeTypes(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(type);
      } else {
        newSet.delete(type);
      }
      return newSet;
    });
    onFilterInteraction();
  };

  const handleSourceToggle = (source: string, checked: boolean) => {
    setSelectedSourceFiles(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(source);
      } else {
        newSet.delete(source);
      }
      return newSet;
    });
    onFilterInteraction();
  };

  const uniqueTypes = useMemo(() => {
    return allNodes ? getUniqueValues(allNodes, 'type') : [];
  }, [allNodes]);

  const uniqueSources = useMemo(() => {
    const allFileSources = new Set<string>();
    allNodes.forEach(node => node.source.forEach(s => allFileSources.add(s)));
    allEdges.forEach(edge => edge.source_file.forEach(s => allFileSources.add(s)));
    return Array.from(allFileSources).sort();
  }, [allNodes, allEdges]);

  const filteredUniqueSources = useMemo(() => {
    return uniqueSources.filter(source => 
      source.toLowerCase().includes(nodeSearchQuery.toLowerCase())
    );
  }, [uniqueSources, nodeSearchQuery]);

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (selectedNodeTypes.size > 0 && selectedNodeTypes.size < uniqueTypes.length) {
      parts.push(`${selectedNodeTypes.size} type${selectedNodeTypes.size > 1 ? 's' : ''}`);
    }
    if (selectedSourceFiles.size > 0 && selectedSourceFiles.size < uniqueSources.length) {
      parts.push(`${selectedSourceFiles.size} source${selectedSourceFiles.size > 1 ? 's' : ''}`);
    }
    return parts.join(', ');
  }, [selectedNodeTypes, uniqueTypes, selectedSourceFiles, uniqueSources]);

  // Centralized filtering logic
  const { filteredNodes, filteredEdges } = useMemo(() => {
    // Condition to explicitly show an empty graph if filters have been interacted with
    // AND either no node types or no source files are selected.
    if (hasFiltersBeenInteracted && (selectedNodeTypes.size === 0 || selectedSourceFiles.size === 0)) {
      return { filteredNodes: [], filteredEdges: [] };
    }

    let tempNodes = [...allNodes];
    let tempEdges = [...allEdges];

    // 1. Apply Node Type and Source File filters first to the entire graph
    if (selectedNodeTypes.size > 0) {
      tempNodes = tempNodes.filter((node) => selectedNodeTypes.has(node.type));
    }
    if (selectedSourceFiles.size > 0) {
      tempNodes = tempNodes.filter((node) => 
        node.source.some(s => selectedSourceFiles.has(s))
      );
    }

    // Filter edges based on the already filtered nodes and source files
    const preFilteredNodeIds = new Set(tempNodes.map(node => node.id));
    tempEdges = tempEdges.filter(
      (edge) =>
        preFilteredNodeIds.has(edge.source as string) &&
        preFilteredNodeIds.has(edge.target as string) &&
        (selectedSourceFiles.size === 0 || edge.source_file.some(s => selectedSourceFiles.has(s)))
    );

    // If there's a search query, apply depth filtering
    if (nodeSearchQuery) {
      const lowerCaseQuery = nodeSearchQuery.toLowerCase();
      const initialMatchingNodes = tempNodes.filter(
        (node) =>
          node.label.toLowerCase().includes(lowerCaseQuery) ||
          node.id.toLowerCase().includes(lowerCaseQuery)
      );

      if (initialMatchingNodes.length === 0) {
        return { filteredNodes: [], filteredEdges: [] }; // No matching nodes, so nothing to show
      }

      let nodesInDepth = new Set<GraphNode>(initialMatchingNodes);
      let edgesInDepth = new Set<GraphEdge>();
      let currentLevelNodes = initialMatchingNodes;

      // Create an adjacency list for efficient neighbor lookup
      const adjacencyList = new Map<string, { node: GraphNode, edges: GraphEdge[] }>();
      tempNodes.forEach(node => adjacencyList.set(node.id, { node, edges: [] }));
      tempEdges.forEach(edge => {
        adjacencyList.get(edge.source as string)?.edges.push(edge);
        adjacencyList.get(edge.target as string)?.edges.push(edge); // Add for undirected traversal
      });

      // If searchDepth is 0, we only want the initial matching nodes and no edges
      if (searchDepth === 0) {
        return { filteredNodes: Array.from(nodesInDepth), filteredEdges: [] };
      }

      // For searchDepth > 0, perform hops
      // The loop should run 'searchDepth' times to get 'searchDepth' hops
      for (let depth = 0; depth < searchDepth; depth++) {
        if (currentLevelNodes.length === 0) break;

        const nextLevelNodes: GraphNode[] = [];
        const visitedThisLevel = new Set<string>(); // To avoid re-processing nodes within the same hop

        for (const node of currentLevelNodes) {
          if (visitedThisLevel.has(node.id)) continue;
          visitedThisLevel.add(node.id);

          const connectedData = adjacencyList.get(node.id);
          if (connectedData) {
            for (const edge of connectedData.edges) {
              // Only add edges if both source and target are in the current filtered set
              const sourceNodeInFilter = nodesInDepth.has(tempNodes.find(n => n.id === edge.source)!);
              const targetNodeInFilter = nodesInDepth.has(tempNodes.find(n => n.id === edge.target)!);
              if (sourceNodeInFilter && targetNodeInFilter) {
                 edgesInDepth.add(edge);
              }

              const neighborId = edge.source === node.id ? edge.target : edge.source;
              const neighborNode = tempNodes.find(n => n.id === neighborId);

              if (neighborNode && !nodesInDepth.has(neighborNode)) {
                nodesInDepth.add(neighborNode);
                nextLevelNodes.push(neighborNode);
              }
            }
          }
        }
        currentLevelNodes = nextLevelNodes;
      }

      // After the loop, filter edges again to ensure only edges between `nodesInDepth` are included.
      const finalNodesInDepthIds = new Set(Array.from(nodesInDepth).map(n => n.id));
      const finalEdgesInDepth = Array.from(edgesInDepth).filter(edge =>
        finalNodesInDepthIds.has(edge.source as string) && finalNodesInDepthIds.has(edge.target as string)
      );

      return { filteredNodes: Array.from(nodesInDepth), filteredEdges: finalEdgesInDepth };

    } else {
      // If no search query, or search query is empty, return the initially filtered graph
      const finalFilteredNodeIds = new Set(tempNodes.map(node => node.id));
      const finalFilteredEdges = tempEdges.filter(edge =>
        finalFilteredNodeIds.has(edge.source as string) && finalFilteredNodeIds.has(edge.target as string)
      );
      return { filteredNodes: tempNodes, filteredEdges: finalFilteredEdges };
    }
  }, [allNodes, allEdges, nodeSearchQuery, searchDepth, selectedNodeTypes, selectedSourceFiles, hasFiltersBeenInteracted]);

  let alertMessage = "";
  if (!currentWorkspace) {
    alertMessage = "Please select a workspace using the selector in the navigation bar to view the knowledge graph.";
  } else if (loading) {
    alertMessage = "Loading knowledge graph...";
  } else if (error) {
    alertMessage = error;
  } else if (allNodes.length === 0 && allEdges.length === 0) {
    alertMessage = "No knowledge graph data found for this workspace. Please ensure documents are uploaded and preprocessing is complete.";
  } else if (hasFiltersBeenInteracted && (selectedNodeTypes.size === 0 || selectedSourceFiles.size === 0)) {
    alertMessage = "Please select node types and/or source files to display the graph.";
  } else if (filteredNodes.length === 0 && (hasFiltersBeenInteracted || nodeSearchQuery || selectedNodeTypes.size > 0 || selectedSourceFiles.size > 0)) {
    alertMessage = "No graph data matches your current filters. Adjust your filters or clear them to see the full graph.";
  } else if (filteredNodes.length === 0) {
    alertMessage = "No graph data found for this workspace. Please ensure documents are uploaded and preprocessing is complete.";
  }

  const handleGraphBackgroundClick = useCallback(() => {
    setSelectedItem(null);
  }, []);

  return (
    <div className="relative h-full w-full p-4 bg-gradient-to-br from-background to-muted/20">
      {currentWorkspace && !loading && !error ? (
        <div className={cn(
          "relative h-full w-full rounded-xl border shadow-lg bg-card",
          isDetailPanelOpen ? "mr-72" : "mr-10" // Adjust margin based on panel state
        )}>
          {filteredNodes.length > 0 ? (
            <InteractiveGraphVisualization
              nodes={filteredNodes}
              edges={filteredEdges}
              onSelect={setSelectedItem}
              selectedItem={selectedItem}
              onGraphBackgroundClick={handleGraphBackgroundClick}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <Alert className="max-w-lg">
                <Info className="h-4 w-4" />
                <AlertTitle>No Graph Data</AlertTitle>
                <AlertDescription>
                  {alertMessage}
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center h-full p-4">
          <Alert className="max-w-lg">
            <Info className="h-4 w-4" />
            <AlertTitle>{loading ? "Loading..." : "Information"}</AlertTitle>
            <AlertDescription>
              {alertMessage}
            </AlertDescription>
          </Alert>
        </div>
      )}
      
      {/* Refresh Button (Top Center Overlay) */}
      <Button 
        variant="outline" 
        size="icon" 
        onClick={handleRefreshGraph} 
        disabled={loading}
        className="absolute top-8 left-1/2 transform -translate-x-1/2 z-10 shadow-lg"
      >
        <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
      </Button>

      {/* Main Filter Popover (Overlay) */}
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            className="absolute top-8 left-8 z-10 shadow-lg flex items-center gap-2"
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
          {/* Node Search Section */}
          <div>
            <h4 className="font-semibold mb-2 text-sm">Node Search</h4>
            <Input
              placeholder="Search by label or ID..."
              value={nodeSearchQuery}
              onChange={(e) => { setNodeSearchQuery(e.target.value); onFilterInteraction(); }}
              className="mb-3"
            />
            <div className="mt-2 space-y-1">
              <Label htmlFor="search-depth" className="text-sm font-medium">
                Search Depth: {searchDepth} {searchDepth === 0 ? "(Only searched nodes)" : "hops"}
              </Label>
              <input
                id="search-depth"
                type="range"
                min="0"
                max="5"
                value={searchDepth}
                onChange={(e) => { setSearchDepth(Number(e.target.value)); onFilterInteraction(); }}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
              <p className="text-xs text-muted-foreground">
                Controls how many "hops" away from the searched node(s) are displayed.
              </p>
            </div>
          </div>

          <Separator />

          {/* Node Type Filter Section */}
          <div>
            <h4 className="font-semibold mb-2 text-sm">Node Type ({selectedNodeTypes.size}/{uniqueTypes.length})</h4>
            <div className="flex space-x-2 mb-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => { setSelectedNodeTypes(new Set(uniqueTypes)); onFilterInteraction(); }}
                disabled={selectedNodeTypes.size === uniqueTypes.length}
              >
                Select All
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => { setSelectedNodeTypes(new Set()); onFilterInteraction(); }}
                disabled={selectedNodeTypes.size === 0}
              >
                Clear All
              </Button>
            </div>
            <Popover> {/* Nested Popover for Node Types */}
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {selectedNodeTypes.size === uniqueTypes.length ? "All Types" : `${selectedNodeTypes.size} Type(s) Selected`}
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0">
                <Command>
                  <CommandInput placeholder="Search types..." />
                  <CommandList className="hide-scrollbar">
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
                              checked={selectedNodeTypes.has(type)}
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
            <h4 className="font-semibold mb-2 text-sm">Source Document ({selectedSourceFiles.size}/{uniqueSources.length})</h4>
            <div className="flex space-x-2 mb-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => { setSelectedSourceFiles(new Set(uniqueSources)); onFilterInteraction(); }}
                disabled={selectedSourceFiles.size === uniqueSources.length}
              >
                Select All
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => { setSelectedSourceFiles(new Set()); onFilterInteraction(); }}
                disabled={selectedSourceFiles.size === 0}
              >
                Clear All
              </Button>
            </div>
            <Input
              placeholder="Search source documents..."
              value={nodeSearchQuery} // Reusing nodeSearchQuery for source search for simplicity
              onChange={(e) => { setNodeSearchQuery(e.target.value); onFilterInteraction(); }}
              className="mb-3"
            />
            <ScrollArea className="h-48 border rounded-md p-2 hide-scrollbar">
              <div className="space-y-2">
                {filteredUniqueSources.length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-4">No matching sources.</p>
                )}
                {filteredUniqueSources.map(source => (
                  <div key={source} className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent/50">
                    <Checkbox
                      id={`source-${source}`}
                      checked={selectedSourceFiles.has(source)}
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

      {/* Right Detail Sidebar Panel */}
      <div 
        className={cn(
          "absolute top-4 right-4 z-10 transition-all duration-300",
          "bg-card border shadow-xl flex flex-col h-[calc(100%-2rem)] rounded-xl", // Full height minus padding
          isDetailPanelOpen ? "w-72" : "w-10" // Width based on open state
        )}
      >
        <div className="flex items-center justify-between p-3 border-b flex-shrink-0">
          {isDetailPanelOpen && <h3 className="text-lg font-semibold">Details</h3>}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsDetailPanelOpen(!isDetailPanelOpen)}
            className="ml-auto" // Push to the right
          >
            {isDetailPanelOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
        
        {isDetailPanelOpen && (
          <ScrollArea className="overflow-y-auto flex-grow hide-scrollbar">
            <DetailPanel item={selectedItem} workspaceName={currentWorkspace} />
          </ScrollArea>
        )}
      </div>
    </div>
  );
};

export default KnowledgeBase;