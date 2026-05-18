"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  FolderOpen,
  Globe,
  Info,
  RefreshCw,
  Loader2,
  PanelLeftOpen,
  FileText,
  Layers,
  CircleDot,
} from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { InteractiveGraphVisualization } from "@/components/InteractiveGraphVisualization";
import SourceFilesPanel from "@/components/SourceFilesPanel";
import GraphEntitySearchBar from "@/components/GraphEntitySearchBar";
import FlaggedWorkspacesPanel from "@/components/FlaggedWorkspacesPanel";
import DetailPanel from "@/components/DetailPanel";
import { KbGraphSidePanel } from "@/components/knowledge-base/KbGraphSidePanel";
import { collectGraphWorkspaceNames, getGraphNodeWorkspace } from "@/lib/graphWorkspace";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  getKnowledgeGraphEntityTypes,
  getFilteredKnowledgeGraph,
  searchKnowledgeEntities,
  topEntityTypesByCount,
  KB_DEFAULT_DEPTH,
  KB_DEFAULT_LIMIT,
  KB_DEFAULT_SEARCH_THRESHOLD,
  KB_INITIAL_TYPE_COUNT,
  type EntityTypeEntry,
  type EntitySearchMatch,
  GraphNode,
  GraphEdge,
} from "@/database/workspaceStorage";
import { GraphLoadControls, type GraphLoadParams } from "@/components/GraphLoadControls";
import { scopedGraphNodeId } from "@/lib/graphWorkspace";
import {
  getStoredChatScope,
  setStoredChatScope,
  type ChatScope,
} from "@/database/chatStorage";
import { showError } from "@/utils/toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type ActiveFilterPanel = "none" | "sourceFiles" | "workspaces";

const KnowledgeBase = () => {
  console.log("KnowledgeBase: Component rendered.");
  const { currentWorkspace } = useWorkspace();
  const [kbScope, setKbScope] = useState<ChatScope>(() => getStoredChatScope());
  const [allNodes, setAllNodes] = useState<GraphNode[]>([]);
  const [allEdges, setAllEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<GraphNode | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // State for the single active filter panel
  const [activeFilterPanel, setActiveFilterPanel] = useState<ActiveFilterPanel>('none');

  // Refs for the panels and filter buttons container
  const rotatingFilterPanelRef = useRef<HTMLDivElement>(null);
  const filterButtonsContainerRef = useRef<HTMLDivElement>(null);
  const graphSearchRef = useRef<HTMLDivElement>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);

  const [entityTypeCatalog, setEntityTypeCatalog] = useState<EntityTypeEntry[]>([]);
  const [graphLoadParams, setGraphLoadParams] = useState<GraphLoadParams>({
    depth: KB_DEFAULT_DEPTH,
    limit: KB_DEFAULT_LIMIT,
  });
  const [apiSelectedEntityTypes, setApiSelectedEntityTypes] = useState<Set<string>>(new Set());
  const [nodeSearchQuery, setNodeSearchQuery] = useState("");
  const [searchThreshold, setSearchThreshold] = useState(KB_DEFAULT_SEARCH_THRESHOLD);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchMatches, setSearchMatches] = useState<EntitySearchMatch[]>([]);
  const [truncated, setTruncated] = useState(false);

  const [selectedNodeTypes, setSelectedNodeTypes] = useState<Set<string>>(new Set());
  const [selectedSourceFiles, setSelectedSourceFiles] = useState<Set<string>>(new Set());
  const [selectedFlaggedWorkspaces, setSelectedFlaggedWorkspaces] = useState<Set<string>>(
    new Set()
  );

  const [hasFiltersBeenInteracted, setHasFiltersBeenInteracted] = useState(false);
  const [showSearchMatches, setShowSearchMatches] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [graphLoadOpen, setGraphLoadOpen] = useState(false);
  const [graphControlsOpen, setGraphControlsOpen] = useState(false);

  const flaggedWorkspaceNames = useMemo(
    () => (kbScope === "global" ? collectGraphWorkspaceNames(allNodes) : []),
    [kbScope, allNodes]
  );

  const onFilterInteraction = useCallback(() => {
    setHasFiltersBeenInteracted(true);
  }, []);

  const handleKbScopeChange = useCallback((scope: ChatScope) => {
    setKbScope(scope);
    setStoredChatScope(scope);
    setSelectedFlaggedWorkspaces(new Set());
    setActiveFilterPanel("none");
  }, []);

  const applyGraphResponse = useCallback(
    (data: { nodes?: GraphNode[]; edges?: GraphEdge[]; truncated?: boolean }) => {
      const processedNodes: GraphNode[] = data.nodes || [];
      const nodeIds = new Set(processedNodes.map((node) => node.id));

      const processedEdges: GraphEdge[] = (data.edges || []).filter(
        (edge) => nodeIds.has(edge.source as string) && nodeIds.has(edge.target as string)
      );

      setAllNodes(processedNodes);
      setAllEdges(processedEdges);
      setTruncated(Boolean(data.truncated));

      if (processedNodes.length > 0) {
        setSelectedNodeTypes(new Set(processedNodes.map((node) => node.type)));

        const allFileSources = new Set<string>();
        processedNodes.forEach((node) => node.source.forEach((s) => allFileSources.add(s)));
        processedEdges.forEach((edge) => edge.source_file.forEach((s) => allFileSources.add(s)));
        setSelectedSourceFiles(allFileSources);
      } else {
        setSelectedNodeTypes(new Set());
        setSelectedSourceFiles(new Set());
      }
    },
    []
  );

  const clearGraphState = useCallback(() => {
    setAllNodes([]);
    setAllEdges([]);
    setLoading(false);
    setError(null);
    setSelectedItem(null);
    setHasFiltersBeenInteracted(false);
    setEntityTypeCatalog([]);
    setApiSelectedEntityTypes(new Set());
    setNodeSearchQuery("");
    setIsSearchMode(false);
    setSearchMatches([]);
    setTruncated(false);
    setSearchThreshold(KB_DEFAULT_SEARCH_THRESHOLD);
    setGraphLoadParams({ depth: KB_DEFAULT_DEPTH, limit: KB_DEFAULT_LIMIT });
    setSelectedNodeTypes(new Set());
    setSelectedSourceFiles(new Set());
    setSelectedFlaggedWorkspaces(new Set());
  }, []);

  useEffect(() => {
    if (kbScope !== "global" || flaggedWorkspaceNames.length === 0) return;
    setSelectedFlaggedWorkspaces((prev) => {
      if (prev.size === 0) return new Set(flaggedWorkspaceNames);
      const next = new Set([...prev].filter((w) => flaggedWorkspaceNames.includes(w)));
      return next.size > 0 ? next : new Set(flaggedWorkspaceNames);
    });
  }, [kbScope, flaggedWorkspaceNames]);

  const loadBrowseGraph = useCallback(
    async (
      scope: ChatScope,
      workspaceName: string | null,
      types: Set<string>,
      loadParams: GraphLoadParams
    ) => {
      if (types.size === 0) {
        setAllNodes([]);
        setAllEdges([]);
        setTruncated(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const entityTypes = Array.from(types);
        const data =
          scope === "global"
            ? await getFilteredKnowledgeGraph({ flagged: true }, {
                entityTypes,
                depth: loadParams.depth,
                limit: loadParams.limit,
              })
            : await getFilteredKnowledgeGraph(
                { workspaceName: workspaceName! },
                {
                  entityTypes,
                  depth: loadParams.depth,
                  limit: loadParams.limit,
                }
              );
        setIsSearchMode(false);
        setSearchMatches([]);
        applyGraphResponse(data);
      } catch (err: unknown) {
        console.error("KnowledgeBase: loadBrowseGraph error:", err);
        setError(
          scope === "global"
            ? "Failed to load knowledge graph for starred workspaces."
            : "Failed to load knowledge graph for this workspace."
        );
        showError("Failed to load knowledge graph.");
        setAllNodes([]);
        setAllEdges([]);
        setSelectedNodeTypes(new Set());
        setSelectedSourceFiles(new Set());
      } finally {
        setLoading(false);
      }
    },
    [applyGraphResponse]
  );

  const loadEntityTypeCatalog = useCallback(
    async (scope: ChatScope, workspaceName: string | null) => {
      setLoading(true);
      setError(null);
      setAllNodes([]);
      setAllEdges([]);
      setHasFiltersBeenInteracted(false);
      setIsSearchMode(false);
      setSearchMatches([]);
      setNodeSearchQuery("");
      setTruncated(false);

      try {
        const { entityTypes } =
          scope === "global"
            ? await getKnowledgeGraphEntityTypes({ flagged: true })
            : await getKnowledgeGraphEntityTypes({ workspaceName: workspaceName! });

        setEntityTypeCatalog(entityTypes);
        const initialTypes = new Set(topEntityTypesByCount(entityTypes, KB_INITIAL_TYPE_COUNT));
        setApiSelectedEntityTypes(initialTypes);
        const loadParams = {
          depth: KB_DEFAULT_DEPTH,
          limit: KB_DEFAULT_LIMIT,
        };
        setGraphLoadParams(loadParams);

        if (initialTypes.size > 0) {
          await loadBrowseGraph(scope, workspaceName, initialTypes, loadParams);
        }
      } catch (err: unknown) {
        console.error("KnowledgeBase: loadEntityTypeCatalog error:", err);
        setError(
          scope === "global"
            ? "Failed to load entity types for starred workspaces."
            : "Failed to load entity types for this workspace."
        );
        showError("Failed to load knowledge graph.");
        setEntityTypeCatalog([]);
        setApiSelectedEntityTypes(new Set());
        setAllNodes([]);
        setAllEdges([]);
      } finally {
        setLoading(false);
      }
    },
    [loadBrowseGraph]
  );

  const runSearch = useCallback(async () => {
    const q = nodeSearchQuery.trim();
    if (q.length < 2) return;

    setLoading(true);
    setError(null);
    try {
      const scope =
        kbScope === "global" ? { flagged: true as const } : { workspaceName: currentWorkspace! };

      const result = await searchKnowledgeEntities(scope, {
        q,
        threshold: searchThreshold,
        depth: graphLoadParams.depth,
        limit: graphLoadParams.limit,
        entityTypes:
          apiSelectedEntityTypes.size > 0 ? Array.from(apiSelectedEntityTypes) : undefined,
      });

      setIsSearchMode(true);
      setSearchMatches(result.matches ?? []);
      applyGraphResponse(result.graphPayload);
    } catch (err: unknown) {
      console.error("KnowledgeBase: runSearch error:", err);
      showError("Entity search failed.");
      setError("Search failed. Try a lower threshold or different query.");
    } finally {
      setLoading(false);
    }
  }, [
    nodeSearchQuery,
    kbScope,
    currentWorkspace,
    searchThreshold,
    graphLoadParams,
    apiSelectedEntityTypes,
    applyGraphResponse,
  ]);

  const handleClearSearch = useCallback(() => {
    setNodeSearchQuery("");
    setIsSearchMode(false);
    setSearchMatches([]);
    setShowSearchMatches(false);
    void loadBrowseGraph(kbScope, currentWorkspace ?? null, apiSelectedEntityTypes, graphLoadParams);
  }, [kbScope, currentWorkspace, apiSelectedEntityTypes, graphLoadParams, loadBrowseGraph]);

  const handleClearAllFilters = useCallback(() => {
    const initialTypes = new Set(topEntityTypesByCount(entityTypeCatalog, KB_INITIAL_TYPE_COUNT));
    const loadParams = { depth: KB_DEFAULT_DEPTH, limit: KB_DEFAULT_LIMIT };
    setApiSelectedEntityTypes(initialTypes);
    setGraphLoadParams(loadParams);
    setNodeSearchQuery("");
    setIsSearchMode(false);
    setSearchMatches([]);
    setShowSearchMatches(false);
    setSearchThreshold(KB_DEFAULT_SEARCH_THRESHOLD);
    setHasFiltersBeenInteracted(false);
    void loadBrowseGraph(kbScope, currentWorkspace ?? null, initialTypes, loadParams);
  }, [entityTypeCatalog, kbScope, currentWorkspace, loadBrowseGraph]);

  const handleApplyGraphLoad = useCallback(() => {
    setHasFiltersBeenInteracted(true);
    if (isSearchMode) {
      void runSearch();
    } else {
      void loadBrowseGraph(
        kbScope,
        currentWorkspace ?? null,
        apiSelectedEntityTypes,
        graphLoadParams
      );
    }
  }, [
    isSearchMode,
    runSearch,
    loadBrowseGraph,
    kbScope,
    currentWorkspace,
    apiSelectedEntityTypes,
    graphLoadParams,
  ]);

  const handleSearchSubmit = useCallback(() => {
    const q = nodeSearchQuery.trim();
    if (q.length < 2) return;
    setShowSearchMatches(true);
    void runSearch();
  }, [nodeSearchQuery, runSearch]);

  const handleHighlightMatch = useCallback(
    (nodeId: string, workspace?: string) => {
      const graphId =
        kbScope === "global" && workspace
          ? scopedGraphNodeId(workspace, nodeId)
          : nodeId;
      const node = allNodes.find((n) => n.id === graphId);
      if (node) setSelectedItem(node);
    },
    [kbScope, allNodes]
  );

  useEffect(() => {
    if (kbScope === "workspace") {
      if (!currentWorkspace?.trim()) {
        clearGraphState();
        return;
      }
      void loadEntityTypeCatalog("workspace", currentWorkspace);
      return;
    }
    void loadEntityTypeCatalog("global", null);
  }, [kbScope, currentWorkspace, refreshCounter, loadEntityTypeCatalog, clearGraphState]);

  const graphReady =
    (kbScope === "global" || !!currentWorkspace?.trim()) && !loading && !error;

  const graphViewResetKey = useMemo(
    () => `${kbScope}-${refreshCounter}-${allNodes.length}-${isSearchMode}`,
    [kbScope, refreshCounter, allNodes.length, isSearchMode]
  );

  const detailWorkspaceName = useMemo(() => {
    if (kbScope === "workspace") return currentWorkspace;
    if (!selectedItem) return null;
    const ws = selectedItem.attributes.__kb_workspace;
    return typeof ws === "string" ? ws : null;
  }, [kbScope, currentWorkspace, selectedItem]);

  const closeKbFloatingPanels = useCallback(() => {
    setActiveFilterPanel("none");
    setSearchExpanded(false);
    setGraphLoadOpen(false);
    setGraphControlsOpen(false);
  }, []);

  const handleSearchExpandedChange = useCallback((expanded: boolean) => {
    if (expanded) {
      setActiveFilterPanel("none");
      setGraphLoadOpen(false);
      setGraphControlsOpen(false);
    }
    setSearchExpanded(expanded);
  }, []);

  const handleGraphLoadOpenChange = useCallback((open: boolean) => {
    if (open) {
      setActiveFilterPanel("none");
      setSearchExpanded(false);
      setGraphControlsOpen(false);
    }
    setGraphLoadOpen(open);
  }, []);

  const handleGraphControlsOpenChange = useCallback((open: boolean) => {
    if (open) {
      setActiveFilterPanel("none");
      setSearchExpanded(false);
      setGraphLoadOpen(false);
    }
    setGraphControlsOpen(open);
  }, []);

  const closeAllFilterPanels = closeKbFloatingPanels;

  // Effect to handle clicks outside the panels
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as globalThis.Node | null;
      if (!target) return;

      if (
        target instanceof Element &&
        target.closest("[data-graph-controls], [data-graph-search], .graph-control-range")
      ) {
        return;
      }

      if (graphSearchRef.current?.contains(target)) {
        return;
      }

      const hasFloatingPanel =
        activeFilterPanel !== "none" ||
        searchExpanded ||
        graphLoadOpen ||
        graphControlsOpen;

      if (!hasFloatingPanel) return;

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

      // Clicks on graph overlays (toolbar, side panels) must not hit the graph below.
      if (
        target instanceof Element &&
        target.closest("[data-kb-overlay]")
      ) {
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

      closeKbFloatingPanels();
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [
    activeFilterPanel,
    searchExpanded,
    graphLoadOpen,
    graphControlsOpen,
    closeKbFloatingPanels,
    setSelectedItem,
  ]);


  const handleRefreshGraph = () => {
    console.log("KnowledgeBase: handleRefreshGraph called.");
    setRefreshCounter(prev => prev + 1);
  };

  // Centralized filtering logic
  const { filteredNodes, filteredEdges } = useMemo(() => {
    // Condition to explicitly show an empty graph if filters have been interacted with
    // AND either no node types or no source files are selected.
    const workspaceFilterActive =
      kbScope === "global" &&
      flaggedWorkspaceNames.length > 0 &&
      selectedFlaggedWorkspaces.size < flaggedWorkspaceNames.length;

    if (apiSelectedEntityTypes.size === 0 && !isSearchMode) {
      return { filteredNodes: [], filteredEdges: [] };
    }

    if (
      hasFiltersBeenInteracted &&
      (selectedNodeTypes.size === 0 ||
        selectedSourceFiles.size === 0 ||
        (kbScope === "global" && selectedFlaggedWorkspaces.size === 0))
    ) {
      return { filteredNodes: [], filteredEdges: [] };
    }

    let tempNodes = [...allNodes];
    let tempEdges = [...allEdges];

    if (kbScope === "global" && selectedFlaggedWorkspaces.size > 0 && workspaceFilterActive) {
      tempNodes = tempNodes.filter((node) => {
        const ws = getGraphNodeWorkspace(node);
        return ws != null && selectedFlaggedWorkspaces.has(ws);
      });
    }

    if (selectedNodeTypes.size > 0) {
      tempNodes = tempNodes.filter((node) => selectedNodeTypes.has(node.type));
    }
    if (selectedSourceFiles.size > 0) {
      tempNodes = tempNodes.filter((node) =>
        node.source.some((s) => selectedSourceFiles.has(s))
      );
    }

    const preFilteredNodeIds = new Set(tempNodes.map((node) => node.id));
    tempEdges = tempEdges.filter(
      (edge) =>
        preFilteredNodeIds.has(edge.source as string) &&
        preFilteredNodeIds.has(edge.target as string) &&
        (selectedSourceFiles.size === 0 ||
          edge.source_file.length === 0 ||
          edge.source_file.some((s) => selectedSourceFiles.has(s)))
    );

    return { filteredNodes: tempNodes, filteredEdges: tempEdges };
  }, [
    allNodes,
    allEdges,
    kbScope,
    apiSelectedEntityTypes.size,
    isSearchMode,
    selectedNodeTypes,
    selectedSourceFiles,
    selectedFlaggedWorkspaces,
    flaggedWorkspaceNames,
    hasFiltersBeenInteracted,
  ]);

  const workspaceFilterActive =
    kbScope === "global" &&
    flaggedWorkspaceNames.length > 0 &&
    selectedFlaggedWorkspaces.size > 0 &&
    selectedFlaggedWorkspaces.size < flaggedWorkspaceNames.length;

  let alertMessage = "";
  if (kbScope === "workspace" && !currentWorkspace?.trim()) {
    alertMessage =
      "Select a workspace in the navigation bar, or switch to Flagged to view all starred workspaces.";
  } else if (loading) {
    alertMessage =
      kbScope === "global"
        ? "Loading knowledge graph for starred workspaces..."
        : "Loading knowledge graph...";
  } else if (error) {
    alertMessage = error;
  } else if (allNodes.length === 0 && allEdges.length === 0) {
    alertMessage =
      kbScope === "global"
        ? "No knowledge graph data for starred workspaces. Star one or more workspaces and ensure documents are uploaded and preprocessing is complete."
        : "No knowledge graph data for this workspace. Upload documents and complete preprocessing.";
  } else if (apiSelectedEntityTypes.size === 0 && entityTypeCatalog.length > 0) {
    alertMessage =
      "Select at least one entity type in Graph load, then click Load graph.";
  } else if (isSearchMode && searchMatches.length === 0) {
    alertMessage = "No entities matched your search. Try a lower threshold or different spelling.";
  } else if (
    hasFiltersBeenInteracted &&
    (selectedNodeTypes.size === 0 ||
      selectedSourceFiles.size === 0 ||
      (kbScope === "global" && selectedFlaggedWorkspaces.size === 0))
  ) {
    alertMessage =
      kbScope === "global" && selectedFlaggedWorkspaces.size === 0
        ? "Select at least one starred workspace to display the graph."
        : "Please select node types and/or source files to display the graph.";
  } else if (
    filteredNodes.length === 0 &&
    (hasFiltersBeenInteracted ||
      isSearchMode ||
      selectedNodeTypes.size > 0 ||
      selectedSourceFiles.size > 0 ||
      (kbScope === "global" && workspaceFilterActive))
  ) {
    alertMessage =
      "No graph data matches your current filters. Adjust filters or use Clear all filters.";
  } else if (filteredNodes.length === 0) {
    alertMessage =
      kbScope === "global"
        ? "No graph data for starred workspaces. Ensure documents are uploaded and preprocessing is complete."
        : "No graph data for this workspace. Upload documents and complete preprocessing.";
  }


  const handleTogglePanel = useCallback((panelName: ActiveFilterPanel) => {
    setSearchExpanded(false);
    setGraphLoadOpen(false);
    setGraphControlsOpen(false);
    setActiveFilterPanel((prev) => (prev === panelName ? "none" : panelName));
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="z-10 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-background px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="shrink-0 text-base font-semibold">Knowledge graph</h1>
          {truncated && (
            <Badge variant="outline" className="shrink-0 border-amber-500/50 text-amber-700 dark:text-amber-300">
              Subgraph truncated
            </Badge>
          )}
          {isSearchMode && (
            <Badge variant="secondary" className="shrink-0 font-normal">
              Search results
            </Badge>
          )}
          <Badge variant="secondary" className="max-w-[200px] truncate font-normal">
            {kbScope === "global" ? (
              <>
                <Globe className="mr-1 inline h-3 w-3" />
                {workspaceFilterActive
                  ? `${selectedFlaggedWorkspaces.size} of ${flaggedWorkspaceNames.length} workspaces`
                  : flaggedWorkspaceNames.length > 0
                    ? `All ${flaggedWorkspaceNames.length} starred`
                    : "Starred workspaces"}
              </>
            ) : (
              <>
                <FolderOpen className="mr-1 inline h-3 w-3" />
                {currentWorkspace?.trim() || "No workspace"}
              </>
            )}
          </Badge>
        </div>

        <Tabs value={kbScope} onValueChange={(v) => handleKbScopeChange(v as ChatScope)}>
          <TabsList className="h-8">
            <TabsTrigger value="workspace" disabled={loading} className="px-3 text-xs">
              Workspace
            </TabsTrigger>
            <TabsTrigger value="global" disabled={loading} className="px-3 text-xs">
              Flagged
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden p-4">
      {graphReady ? (
        <div ref={graphContainerRef} className="relative h-full w-full overflow-hidden rounded-lg border bg-card shadow-lg">
          <InteractiveGraphVisualization
            nodes={filteredNodes}
            edges={filteredEdges}
            onSelect={(node) => {
              setSelectedItem(node);
              if (node) closeKbFloatingPanels();
            }}
            selectedItem={selectedItem}
            onGraphBackgroundClick={closeAllFilterPanels}
            showControls={filteredNodes.length > 0}
            graphControlsOpen={graphControlsOpen}
            onGraphControlsOpenChange={handleGraphControlsOpenChange}
            viewResetKey={graphViewResetKey}
            bottomLeftOverlay={
              <GraphLoadControls
                params={graphLoadParams}
                onParamsChange={setGraphLoadParams}
                entityTypes={entityTypeCatalog}
                selectedEntityTypes={apiSelectedEntityTypes}
                onSelectedEntityTypesChange={setApiSelectedEntityTypes}
                onApply={handleApplyGraphLoad}
                onClearAll={handleClearAllFilters}
                loading={loading}
                open={graphLoadOpen}
                onOpenChange={handleGraphLoadOpenChange}
              />
            }
          />
          {filteredNodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
              <Alert className="pointer-events-auto max-w-lg">
                <Info className="h-4 w-4" />
                <AlertTitle>No Graph Data</AlertTitle>
                <AlertDescription>{alertMessage}</AlertDescription>
              </Alert>
            </div>
          )}

          <div
            data-kb-overlay
            className="pointer-events-none absolute inset-x-3 top-3 z-[110] h-9"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div
              ref={graphSearchRef}
              className="pointer-events-auto absolute left-0 top-0 z-[100]"
            >
              <GraphEntitySearchBar
                searchQuery={nodeSearchQuery}
                onSearchQueryChange={setNodeSearchQuery}
                searchThreshold={searchThreshold}
                onSearchThresholdChange={setSearchThreshold}
                onSearch={handleSearchSubmit}
                loading={loading}
                expanded={searchExpanded}
                onExpandedChange={handleSearchExpandedChange}
                matchesPanel={
                  showSearchMatches && searchMatches.length > 0 ? (
                    <ul className="space-y-0.5">
                      {searchMatches.map((m) => (
                        <li key={`${m.workspace ?? ""}-${m.id}`}>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60"
                            onClick={() => handleHighlightMatch(m.id, m.workspace)}
                          >
                            <span className="min-w-0 flex-1 truncate font-medium" title={m.name}>
                              {m.name}
                            </span>
                            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                              {m.score.toFixed(2)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : undefined
                }
              />
            </div>

            <div
              ref={filterButtonsContainerRef}
              id="filter-buttons-container"
              className="pointer-events-auto absolute left-1/2 top-0 z-[100] flex h-9 -translate-x-1/2 items-center gap-2"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {kbScope === "global" && flaggedWorkspaceNames.length > 0 && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => handleTogglePanel("workspaces")}
                  title={
                    activeFilterPanel === "workspaces"
                      ? "Hide Workspaces Panel"
                      : "Filter by workspace"
                  }
                >
                  {activeFilterPanel === "workspaces" ? (
                    <PanelLeftOpen className="h-4 w-4" />
                  ) : (
                    <Layers className="h-4 w-4" />
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => handleTogglePanel("sourceFiles")}
                title={
                  activeFilterPanel === "sourceFiles"
                    ? "Hide Source Files Panel"
                    : "Show Source Files Panel"
                }
              >
                {activeFilterPanel === "sourceFiles" ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
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
            </div>

            <div className="absolute right-0 top-0 h-9 w-9" aria-hidden />
          </div>

          <div
            ref={rotatingFilterPanelRef}
            id="rotating-filter-panel-container"
            data-kb-overlay
            className={cn(
              "absolute left-3 z-20 flex min-h-0 w-[var(--filter-panel-width)] flex-col overflow-hidden transition-transform duration-300 ease-in-out",
              "top-[var(--panel-top-offset)] bottom-[var(--panel-bottom-offset)]",
              activeFilterPanel !== "none"
                ? "translate-x-0 opacity-100"
                : "-translate-x-[calc(100%+0.75rem)] pointer-events-none opacity-0"
            )}
          >
            {activeFilterPanel === "workspaces" && kbScope === "global" && (
              <FlaggedWorkspacesPanel
                nodes={allNodes}
                workspaceNames={flaggedWorkspaceNames}
                selectedWorkspaces={selectedFlaggedWorkspaces}
                onSelectedWorkspacesChange={setSelectedFlaggedWorkspaces}
                onClose={() => setActiveFilterPanel("none")}
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

          {!loading && !error && (allNodes.length > 0 || allEdges.length > 0) && (
            <div
              id="detail-panel-container"
              data-kb-overlay
              className={cn(
                "absolute right-3 z-20 flex min-h-0 w-[var(--detail-panel-width)] flex-col overflow-hidden transition-transform duration-300 ease-in-out",
                "top-[var(--panel-top-offset)] bottom-[var(--panel-bottom-offset)]",
                selectedItem
                  ? "translate-x-0 opacity-100"
                  : "pointer-events-none translate-x-[calc(100%+0.75rem)] opacity-0"
              )}
            >
              <KbGraphSidePanel
                title={selectedItem ? selectedItem.label : "Entity details"}
                icon={<CircleDot className="h-4 w-4" />}
                onClose={() => setSelectedItem(null)}
              >
                <DetailPanel item={selectedItem} workspaceName={detailWorkspaceName} />
              </KbGraphSidePanel>
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
    </div>
  );
};

export default KnowledgeBase;
