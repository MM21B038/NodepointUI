"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { BookOpen, Info, RefreshCw, Loader2, PanelRightClose, PanelLeftOpen, Search, Network, FileText } from "lucide-react"; // Added ChevronLeft, ChevronRight
import { useWorkspace } from "@/context/WorkspaceContext";
import { InteractiveGraphVisualization, DetailPanel } from "@/components/InteractiveGraphVisualization";
import SearchNodesPanel from "@/components/SearchNodesPanel";
import NodeTypesPanel from "@/components/NodeTypesPanel";
import SourceFilesPanel from "@/components/SourceFilesPanel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getKnowledgeGraph, GraphNode, GraphEdge, FileReference } from "@/database/workspaceStorage";
import { showError } from "@/utils/toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

type ActiveFilterPanel = 'none' | 'search' | 'nodeTypes' | 'sourceFiles';

const KnowledgeBase = () => {
  console.log("KnowledgeBase: Component rendered.");
  const { currentWorkspace } = useWorkspace();
  const [allNodes, setAllNodes] = useState<GraphNode[]>([]);
  const [allEdges, setAllEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<GraphNode | GraphEdge | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // State for the single active filter panel
  const [activeFilterPanel, setActiveFilterPanel] = useState<ActiveFilterPanel>('none');

  // Refs for the panels and filter buttons container
  const rotatingFilterPanelRef = useRef<HTMLDivElement>(null); // Ref for the single rotating panel container
  const filterButtonsContainerRef = useRef<HTMLDivElement>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);

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

      // The normalization to string[] is now handled in getKnowledgeGraph in workspaceStorage.ts
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

  // Callback to close all filter panels
  const closeAllFilterPanels = useCallback(() => {
    setActiveFilterPanel('none');
  }, []);

  // Effect to handle clicks outside the panels
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // If no filter panel is currently active, there's nothing to close.
      if (activeFilterPanel === 'none') return;

      // Check if the click originated from within the filter buttons container.
      // Clicking these buttons should toggle panels, not close them.
      if (filterButtonsContainerRef.current && filterButtonsContainerRef.current.contains(target)) {
        return;
      }

      // Check if the click originated from within the active filter panel itself,
      // or any of its content rendered via React Portals (like dropdowns).
      const isClickInsideFilterPanel = (
        rotatingFilterPanelRef.current && rotatingFilterPanelRef.current.contains(target)
      ) || target.closest(
        '[data-radix-popper-content], [data-radix-dropdown-menu-content], [data-radix-menu-content]'
      );

      if (isClickInsideFilterPanel) {
        // If the click is inside the filter panel or its associated Radix UI portals, do not close.
        return;
      }

      // Check if the click is inside the graph visualization area.
      // If so, deselect item and close filter panels.
      if (graphContainerRef.current && graphContainerRef.current.contains(target)) {
        setSelectedItem(null);
        closeAllFilterPanels();
        return;
      }

      // Check if the click is inside the detail panel.
      // Clicking the detail panel should not close the filter panel.
      const detailPanelElement = document.getElementById('detail-panel-container');
      if (detailPanelElement && detailPanelElement.contains(target)) {
        return;
      }

      // If the click is not within any of the above elements, it's truly an "outside" click for the filter panels.
      setActiveFilterPanel('none');
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeFilterPanel, closeAllFilterPanels, setSelectedItem]);


  const handleRefreshGraph = () => {
    console.log("KnowledgeBase: handleRefreshGraph called.");
    setRefreshCounter(prev => prev + 1);
  };

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


  const handleTogglePanel = useCallback((panelName: ActiveFilterPanel) => {
    setActiveFilterPanel(prev => (prev === panelName ? 'none' : panelName));
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden p-4">
      {currentWorkspace && !loading && !error ? (
        <div ref={graphContainerRef} className="relative h-full w-full border rounded-lg shadow-lg bg-card">
          {filteredNodes.length > 0 ? (
            <InteractiveGraphVisualization
              nodes={filteredNodes}
              edges={filteredEdges}
              onSelect={setSelectedItem}
              selectedItem={selectedItem}
              onGraphBackgroundClick={closeAllFilterPanels}
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

          {/* Filter/Refresh Buttons - now fixed at top center */}
          <div ref={filterButtonsContainerRef} id="filter-buttons-container" className="absolute top-4 left-1/2 -translate-x-1/2 z-30 p-2 bg-background/50 backdrop-blur-sm rounded-lg flex flex-row space-x-2">
            {currentWorkspace && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleTogglePanel('search')}
                  title={activeFilterPanel === 'search' ? "Hide Search Panel" : "Show Search Panel"}
                >
                  {activeFilterPanel === 'search' ? <PanelLeftOpen className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleTogglePanel('nodeTypes')}
                  title={activeFilterPanel === 'nodeTypes' ? "Hide Node Types Panel" : "Show Node Types Panel"}
                >
                  {activeFilterPanel === 'nodeTypes' ? <PanelLeftOpen className="h-4 w-4" /> : <Network className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleTogglePanel('sourceFiles')}
                  title={activeFilterPanel === 'sourceFiles' ? "Hide Source Files Panel" : "Show Source Files Panel"}
                >
                  {activeFilterPanel === 'sourceFiles' ? <PanelLeftOpen className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRefreshGraph}
                  title="Refresh Graph"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </>
            )}
          </div>

          {/* Single Rotating Filter Panel Container */}
          <div ref={rotatingFilterPanelRef} id="rotating-filter-panel-container" className={cn(
            "absolute left-0 z-20 p-4 transition-transform duration-300 ease-in-out",
            "w-[var(--filter-panel-width)] h-[var(--panel-height)] top-[var(--panel-top-offset)]",
            activeFilterPanel !== 'none' ? "translate-x-0" : "-translate-x-full"
          )}
          // Removed onClick={e => e.stopPropagation()} here
          >
            {activeFilterPanel === 'search' && (
              <SearchNodesPanel
                searchQuery={nodeSearchQuery}
                onSearchQueryChange={setNodeSearchQuery}
                searchDepth={searchDepth}
                onSearchDepthChange={setSearchDepth}
                onClose={() => setActiveFilterPanel('none')}
                onFilterInteraction={onFilterInteraction}
              />
            )}
            {activeFilterPanel === 'nodeTypes' && (
              <NodeTypesPanel
                nodes={allNodes}
                selectedNodeTypes={selectedNodeTypes}
                onSelectedNodeTypesChange={setSelectedNodeTypes}
                onClose={() => setActiveFilterPanel('none')}
                onFilterInteraction={onFilterInteraction}
              />
            )}
            {activeFilterPanel === 'sourceFiles' && (
              <SourceFilesPanel
                nodes={allNodes}
                edges={allEdges}
                selectedSourceFiles={selectedSourceFiles}
                onSelectedSourceFilesChange={setSelectedSourceFiles}
                onClose={() => setActiveFilterPanel('none')}
                onFilterInteraction={onFilterInteraction}
              />
            )}
          </div>

          {/* Detail Panel (right side, higher z-index, relative to the new block) */}
          {currentWorkspace && !loading && !error && (allNodes.length > 0 || allEdges.length > 0) && (
            <div id="detail-panel-container" className={cn(
              "absolute right-0 z-20 p-4 transition-transform duration-300 ease-in-out",
              "w-[var(--detail-panel-width)] h-[var(--panel-height)] top-[var(--panel-top-offset)]",
              selectedItem ? "translate-x-0" : "translate-x-full"
            )}
            // Removed onClick={e => e.stopPropagation()} here
            >
              <div className="h-full bg-background/80 backdrop-blur-sm border-none shadow-lg rounded-lg overflow-hidden">
                <h3 className="text-lg font-semibold p-4 border-b flex items-center justify-between">
                  Details
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedItem(null);
                      console.log("KnowledgeBase: Closing Detail Panel.");
                    }}
                    title="Close Details"
                  >
                    <PanelRightClose className="h-4 w-4" />
                  </Button>
                </h3>
                <ScrollArea className="h-[calc(100%-57px)]">
                  <DetailPanel item={selectedItem} />
                </ScrollArea>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
          <div className="pointer-events-auto bg-card p-6 rounded-lg shadow-lg">
            <Alert className="max-w-lg">
              <Info className="h-4 w-4" />
              <AlertTitle>{loading ? "Loading..." : "Information"}</AlertTitle>
              <AlertDescription>
                {alertMessage}
              </AlertDescription>
            </Alert>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;