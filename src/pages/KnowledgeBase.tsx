"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  FolderOpen,
  Users,
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
import GroupWorkspacesPanel from "@/components/GroupWorkspacesPanel";
import GroupScopeSelector from "@/components/scope/GroupScopeSelector";
import DetailPanel from "@/components/DetailPanel";
import { KbGraphSidePanel } from "@/components/knowledge-base/KbGraphSidePanel";
import { EntityTypeLegendDropdown } from "@/components/knowledge-base/EntityTypeLegendDropdown";
import { collectGraphWorkspaceNames, getGraphNodeWorkspace } from "@/lib/graphWorkspace";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  getKnowledgeGraphEntityTypes,
  getFilteredKnowledgeGraph,
  getGroupMemberNames,
  groupScope,
  listFiles,
  listFilesForWorkspaces,
  resolveGraphFileNamesParam,
  searchKnowledgeEntities,
  topEntityTypesByCount,
  KB_DEFAULT_DEPTH,
  KB_DEFAULT_LIMIT,
  KB_MAX_LIMIT,
  kbDefaultLimitForGroup,
  kbMaxLimitForGroup,
  groupLimitDivisor,
  KB_DEFAULT_SEARCH_THRESHOLD,
  KB_INITIAL_TYPE_COUNT,
  type EntityTypeEntry,
  type EntitySearchMatch,
  GraphNode,
  GraphEdge,
} from "@/database/workspaceStorage";
import { GraphLoadControls, type GraphLoadParams } from "@/components/GraphLoadControls";
import { scopedGraphNodeId } from "@/lib/graphWorkspace";
import type { ViewScopeMode } from "@/lib/viewScope";
import { showError } from "@/utils/toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ActiveFilterPanel = "none" | "sourceFiles" | "workspaces";

const KnowledgeBase = () => {
  console.log("KnowledgeBase: Component rendered.");
  const { currentWorkspace, scopeMode, activeGroup } = useWorkspace();
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
  const [availableSourceFiles, setAvailableSourceFiles] = useState<string[]>([]);
  const [selectedSourceFiles, setSelectedSourceFiles] = useState<Set<string>>(new Set());
  const [selectedGroupWorkspaces, setSelectedGroupWorkspaces] = useState<Set<string>>(
    new Set()
  );

  const [hasFiltersBeenInteracted, setHasFiltersBeenInteracted] = useState(false);
  const [showSearchMatches, setShowSearchMatches] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [graphLoadOpen, setGraphLoadOpen] = useState(false);
  const [graphControlsOpen, setGraphControlsOpen] = useState(false);
  const [groupMemberCount, setGroupMemberCount] = useState(0);
  const [groupMemberNamesFromApi, setGroupMemberNamesFromApi] = useState<string[]>([]);

  const groupWorkspaceNames = useMemo(
    () => (scopeMode === "group" ? collectGraphWorkspaceNames(allNodes) : []),
    [scopeMode, allNodes]
  );

  const workspaceFilterActive = useMemo(
    () =>
      scopeMode === "group" &&
      groupMemberCount > 0 &&
      selectedGroupWorkspaces.size > 0 &&
      selectedGroupWorkspaces.size < groupMemberCount &&
      hasFiltersBeenInteracted,
    [
      scopeMode,
      groupMemberCount,
      selectedGroupWorkspaces.size,
      hasFiltersBeenInteracted,
    ]
  );

  const limitDivisor = useMemo(() => {
    if (scopeMode !== "group") return 1;
    return groupLimitDivisor(
      groupMemberCount,
      selectedGroupWorkspaces.size,
      workspaceFilterActive
    );
  }, [scopeMode, groupMemberCount, selectedGroupWorkspaces.size, workspaceFilterActive]);

  const selectedGroupWorkspacesKey = useMemo(
    () => [...selectedGroupWorkspaces].sort().join("\0"),
    [selectedGroupWorkspaces]
  );

  const resetBrowseUiFilters = useCallback(() => {
    setHasFiltersBeenInteracted(false);
    setIsSearchMode(false);
    setSearchMatches([]);
    setNodeSearchQuery("");
    setShowSearchMatches(false);
    setSearchThreshold(KB_DEFAULT_SEARCH_THRESHOLD);
  }, []);

  const onFilterInteraction = useCallback(() => {
    setHasFiltersBeenInteracted(true);
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
      } else {
        setSelectedNodeTypes(new Set());
      }

      setSelectedItem((prev) => {
        if (!prev) return null;
        return nodeIds.has(prev.id) ? prev : null;
      });
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
    setGroupMemberCount(0);
    setGroupMemberNamesFromApi([]);
    setGraphLoadParams({ depth: KB_DEFAULT_DEPTH, limit: KB_DEFAULT_LIMIT });
    setSelectedNodeTypes(new Set());
    setAvailableSourceFiles([]);
    setSelectedSourceFiles(new Set());
    setSelectedGroupWorkspaces(new Set());
  }, []);

  const loadBrowseGraph = useCallback(
    async (
      mode: ViewScopeMode,
      workspaceName: string | null,
      groupName: string | null,
      types: Set<string>,
      loadParams: GraphLoadParams,
      fileCatalog: string[],
      selectedFiles: Set<string>
    ) => {
      if (types.size === 0) {
        setAllNodes([]);
        setAllEdges([]);
        setTruncated(false);
        return;
      }

      if (fileCatalog.length > 0 && selectedFiles.size === 0) {
        setAllNodes([]);
        setAllEdges([]);
        setTruncated(false);
        setIsSearchMode(false);
        setSearchMatches([]);
        applyGraphResponse({ nodes: [], edges: [], truncated: false });
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const entityTypes = Array.from(types);
        const fileNames = resolveGraphFileNamesParam(fileCatalog, selectedFiles);
        const data =
          mode === "group" && groupName
            ? await getFilteredKnowledgeGraph(groupScope(groupName), {
                entityTypes,
                fileNames,
                depth: loadParams.depth,
                limit: loadParams.limit,
              })
            : await getFilteredKnowledgeGraph(
                { workspaceName: workspaceName! },
                {
                  entityTypes,
                  fileNames,
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
          mode === "group"
            ? "Failed to load knowledge graph for this group."
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
    async (
      mode: ViewScopeMode,
      workspaceName: string | null,
      groupName: string | null
    ) => {
      setLoading(true);
      setError(null);
      setAllNodes([]);
      setAllEdges([]);
      setTruncated(false);
      resetBrowseUiFilters();

      try {
        if (mode === "group") {
          if (!groupName?.trim()) {
            setGroupMemberCount(0);
            setGroupMemberNamesFromApi([]);
            setEntityTypeCatalog([]);
            return;
          }
          const [entityTypesResult, membersResult] = await Promise.allSettled([
            getKnowledgeGraphEntityTypes(groupScope(groupName)),
            getGroupMemberNames(groupName),
          ]);
          if (entityTypesResult.status === "rejected") {
            throw entityTypesResult.reason;
          }
          const { entityTypes } = entityTypesResult.value;
          const apiWorkspaces =
            membersResult.status === "fulfilled" ? membersResult.value : [];
          if (membersResult.status === "rejected") {
            console.warn(
              "KnowledgeBase: group members unavailable",
              membersResult.reason
            );
          }
          const count = apiWorkspaces.length;
          setGroupMemberCount(count);
          setGroupMemberNamesFromApi(apiWorkspaces);
          setSelectedGroupWorkspaces(new Set(apiWorkspaces));
          setEntityTypeCatalog(entityTypes);
          const initialTypes = new Set(topEntityTypesByCount(entityTypes, KB_INITIAL_TYPE_COUNT));
          setApiSelectedEntityTypes(initialTypes);
          const divisor = groupLimitDivisor(count, apiWorkspaces.length, false);
          const loadParams = {
            depth: KB_DEFAULT_DEPTH,
            limit: kbDefaultLimitForGroup(divisor),
          };
          setGraphLoadParams(loadParams);

          const files = await listFilesForWorkspaces(apiWorkspaces);
          setAvailableSourceFiles(files);
          setSelectedSourceFiles(new Set(files));

          if (initialTypes.size > 0 && count > 0) {
            await loadBrowseGraph(
              mode,
              workspaceName,
              groupName,
              initialTypes,
              loadParams,
              files,
              new Set(files)
            );
          }
          return;
        }

        const { entityTypes } = await getKnowledgeGraphEntityTypes({
          workspaceName: workspaceName!,
        });

        setEntityTypeCatalog(entityTypes);
        const initialTypes = new Set(topEntityTypesByCount(entityTypes, KB_INITIAL_TYPE_COUNT));
        setApiSelectedEntityTypes(initialTypes);
        const loadParams = {
          depth: KB_DEFAULT_DEPTH,
          limit: KB_DEFAULT_LIMIT,
        };
        setGraphLoadParams(loadParams);

        const files = await listFiles(workspaceName!);
        setAvailableSourceFiles(files);
        setSelectedSourceFiles(new Set(files));

        if (initialTypes.size > 0) {
          await loadBrowseGraph(
            mode,
            workspaceName,
            null,
            initialTypes,
            loadParams,
            files,
            new Set(files)
          );
        }
      } catch (err: unknown) {
        console.error("KnowledgeBase: loadEntityTypeCatalog error:", err);
        setError(
          mode === "group"
            ? "Failed to load entity types for this group."
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
    [loadBrowseGraph, resetBrowseUiFilters]
  );

  const runSearch = useCallback(async () => {
    const q = nodeSearchQuery.trim();
    if (q.length < 2) return;
    if (scopeMode === "group" && !activeGroup) return;
    if (scopeMode === "workspace" && !currentWorkspace?.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const scope =
        scopeMode === "group" && activeGroup
          ? groupScope(activeGroup)
          : { workspaceName: currentWorkspace! };

      const result = await searchKnowledgeEntities(scope, {
        q,
        threshold: searchThreshold,
        depth: graphLoadParams.depth,
        limit: graphLoadParams.limit,
        entityTypes:
          apiSelectedEntityTypes.size > 0 ? Array.from(apiSelectedEntityTypes) : undefined,
        fileNames: resolveGraphFileNamesParam(availableSourceFiles, selectedSourceFiles),
      });

      setIsSearchMode(true);
      setSearchMatches(result.matches ?? []);
      applyGraphResponse(result.graphPayload);

      if (scopeMode === "group") {
        const wsInGraph = collectGraphWorkspaceNames(result.graphPayload?.nodes ?? []);
        const apiSet = new Set(groupMemberNamesFromApi);
        const inScope = wsInGraph.filter((w) => apiSet.has(w));
        setSelectedGroupWorkspaces(
          new Set(inScope.length > 0 ? inScope : wsInGraph)
        );
      }
    } catch (err: unknown) {
      console.error("KnowledgeBase: runSearch error:", err);
      showError("Entity search failed.");
      setError("Search failed. Try a lower threshold or different query.");
    } finally {
      setLoading(false);
    }
  }, [
    nodeSearchQuery,
    scopeMode,
    currentWorkspace,
    searchThreshold,
    graphLoadParams,
    apiSelectedEntityTypes,
    applyGraphResponse,
    groupMemberNamesFromApi,
    activeGroup,
    availableSourceFiles,
    selectedSourceFiles,
  ]);

  const handleClearSearch = useCallback(() => {
    resetBrowseUiFilters();
    const apiDivisor =
      scopeMode === "group"
        ? groupLimitDivisor(groupMemberCount, groupMemberCount, false)
        : 1;
    const loadParams = {
      depth: KB_DEFAULT_DEPTH,
      limit:
        scopeMode === "group" ? kbDefaultLimitForGroup(apiDivisor) : KB_DEFAULT_LIMIT,
    };
    if (scopeMode === "group" && groupMemberNamesFromApi.length > 0) {
      setSelectedGroupWorkspaces(new Set(groupMemberNamesFromApi));
    }
    setGraphLoadParams(loadParams);
    void loadBrowseGraph(
      scopeMode,
      currentWorkspace ?? null,
      activeGroup,
      apiSelectedEntityTypes,
      loadParams,
      availableSourceFiles,
      selectedSourceFiles
    );
  }, [
    scopeMode,
    currentWorkspace,
    activeGroup,
    apiSelectedEntityTypes,
    groupMemberCount,
    groupMemberNamesFromApi,
    loadBrowseGraph,
    resetBrowseUiFilters,
    availableSourceFiles,
    selectedSourceFiles,
  ]);

  const handleClearAllFilters = useCallback(() => {
    const initialTypes = new Set(topEntityTypesByCount(entityTypeCatalog, KB_INITIAL_TYPE_COUNT));
    const apiDivisor =
      scopeMode === "group"
        ? groupLimitDivisor(groupMemberCount, groupMemberCount, false)
        : 1;
    const loadParams = {
      depth: KB_DEFAULT_DEPTH,
      limit:
        scopeMode === "group" ? kbDefaultLimitForGroup(apiDivisor) : KB_DEFAULT_LIMIT,
    };
    if (scopeMode === "group" && groupMemberNamesFromApi.length > 0) {
      setSelectedGroupWorkspaces(new Set(groupMemberNamesFromApi));
    }
    setApiSelectedEntityTypes(initialTypes);
    setGraphLoadParams(loadParams);
    resetBrowseUiFilters();
    setSelectedSourceFiles(new Set(availableSourceFiles));
    void loadBrowseGraph(
      scopeMode,
      currentWorkspace ?? null,
      activeGroup,
      initialTypes,
      loadParams,
      availableSourceFiles,
      new Set(availableSourceFiles)
    );
  }, [
    entityTypeCatalog,
    scopeMode,
    currentWorkspace,
    activeGroup,
    groupMemberCount,
    groupMemberNamesFromApi,
    loadBrowseGraph,
    resetBrowseUiFilters,
    availableSourceFiles,
  ]);

  const handleSourceFilesChange = useCallback(
    (files: Set<string>) => {
      setSelectedSourceFiles(files);
      setHasFiltersBeenInteracted(true);
      if (isSearchMode) {
        void runSearch();
      } else if (apiSelectedEntityTypes.size > 0) {
        void loadBrowseGraph(
          scopeMode,
          currentWorkspace ?? null,
          activeGroup,
          apiSelectedEntityTypes,
          graphLoadParams,
          availableSourceFiles,
          files
        );
      }
    },
    [
      isSearchMode,
      runSearch,
      scopeMode,
      currentWorkspace,
      activeGroup,
      apiSelectedEntityTypes,
      graphLoadParams,
      availableSourceFiles,
      loadBrowseGraph,
    ]
  );

  const handleApplyGraphLoad = useCallback(() => {
    setHasFiltersBeenInteracted(true);
    if (isSearchMode) {
      void runSearch();
    } else {
      void loadBrowseGraph(
        scopeMode,
        currentWorkspace ?? null,
        activeGroup,
        apiSelectedEntityTypes,
        graphLoadParams,
        availableSourceFiles,
        selectedSourceFiles
      );
    }
  }, [
    isSearchMode,
    runSearch,
    loadBrowseGraph,
    scopeMode,
    currentWorkspace,
    activeGroup,
    apiSelectedEntityTypes,
    graphLoadParams,
    availableSourceFiles,
    selectedSourceFiles,
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
        scopeMode === "group" && workspace
          ? scopedGraphNodeId(workspace, nodeId)
          : nodeId;
      const node = allNodes.find((n) => n.id === graphId);
      if (node) setSelectedItem(node);
    },
    [scopeMode, allNodes]
  );

  useEffect(() => {
    if (scopeMode !== "group" || !hasFiltersBeenInteracted || groupMemberCount < 1) {
      return;
    }

    const divisor = groupLimitDivisor(
      groupMemberCount,
      selectedGroupWorkspaces.size,
      workspaceFilterActive
    );
    const defaultLimit = kbDefaultLimitForGroup(divisor);
    const maxLimit = kbMaxLimitForGroup(divisor);

    setGraphLoadParams((prev) => ({
      depth: prev.depth,
      limit: Math.min(maxLimit, Math.max(1, defaultLimit)),
    }));
  }, [
    scopeMode,
    hasFiltersBeenInteracted,
    workspaceFilterActive,
    groupMemberCount,
    selectedGroupWorkspacesKey,
    selectedGroupWorkspaces.size,
  ]);

  useEffect(() => {
    setSelectedItem(null);
  }, [scopeMode, currentWorkspace, activeGroup]);

  useEffect(() => {
    if (scopeMode === "workspace") {
      if (!currentWorkspace?.trim()) {
        clearGraphState();
        return;
      }
      void loadEntityTypeCatalog("workspace", currentWorkspace, null);
      return;
    }
    if (!activeGroup?.trim()) {
      clearGraphState();
      return;
    }
    void loadEntityTypeCatalog("group", null, activeGroup);
  }, [
    scopeMode,
    currentWorkspace,
    activeGroup,
    refreshCounter,
    loadEntityTypeCatalog,
    clearGraphState,
  ]);

  const graphReady =
    (scopeMode === "group"
      ? !!activeGroup?.trim()
      : !!currentWorkspace?.trim()) &&
    !loading &&
    !error;

  const graphViewResetKey = useMemo(
    () => `${scopeMode}-${refreshCounter}-${allNodes.length}-${isSearchMode}`,
    [scopeMode, refreshCounter, allNodes.length, isSearchMode]
  );

  const detailWorkspaceName = useMemo(() => {
    if (scopeMode === "workspace") return currentWorkspace;
    if (!selectedItem) return null;
    const ws = selectedItem.attributes.__kb_workspace;
    return typeof ws === "string" ? ws : null;
  }, [scopeMode, currentWorkspace, selectedItem]);

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
        target.closest(
          "[data-graph-controls], [data-graph-search], .graph-control-range, [role='slider']"
        )
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
    if (
      hasFiltersBeenInteracted &&
      (selectedNodeTypes.size === 0 ||
        selectedSourceFiles.size === 0 ||
        (scopeMode === "group" && selectedGroupWorkspaces.size === 0))
    ) {
      return { filteredNodes: [], filteredEdges: [] };
    }

    let tempNodes = [...allNodes];
    let tempEdges = [...allEdges];

    if (scopeMode === "group" && selectedGroupWorkspaces.size > 0 && workspaceFilterActive) {
      tempNodes = tempNodes.filter((node) => {
        const ws = getGraphNodeWorkspace(node);
        return ws != null && selectedGroupWorkspaces.has(ws);
      });
    }

    if (selectedNodeTypes.size > 0) {
      tempNodes = tempNodes.filter((node) => selectedNodeTypes.has(node.type));
    }

    const preFilteredNodeIds = new Set(tempNodes.map((node) => node.id));
    tempEdges = tempEdges.filter(
      (edge) =>
        preFilteredNodeIds.has(edge.source as string) &&
        preFilteredNodeIds.has(edge.target as string)
    );

    return { filteredNodes: tempNodes, filteredEdges: tempEdges };
  }, [
    allNodes,
    allEdges,
    scopeMode,
    apiSelectedEntityTypes.size,
    isSearchMode,
    selectedNodeTypes,
    selectedSourceFiles,
    selectedGroupWorkspaces,
    workspaceFilterActive,
    hasFiltersBeenInteracted,
  ]);

  /** Client-side filters only — does not rebuild the D3 simulation (visibility toggled in-graph). */
  const graphVisibleNodeIds = useMemo((): Set<string> | null => {
    if (allNodes.length === 0) return null;
    if (filteredNodes.length === 0) return new Set();

    const filteredIds = new Set(filteredNodes.map((n) => n.id));
    if (filteredIds.size !== allNodes.length) return filteredIds;

    const allIds = new Set(allNodes.map((n) => n.id));
    for (const id of allIds) {
      if (!filteredIds.has(id)) return filteredIds;
    }
    return null;
  }, [allNodes, filteredNodes]);

  const entityTypeLegendItems = useMemo(() => {
    const counts = new Map<string, number>();
    for (const node of filteredNodes) {
      counts.set(node.type, (counts.get(node.type) ?? 0) + 1);
    }
    if (counts.size > 0) {
      return Array.from(counts.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);
    }
    return [...entityTypeCatalog]
      .map(({ type, count }) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredNodes, entityTypeCatalog]);

  let alertMessage = "";
  if (scopeMode === "workspace" && !currentWorkspace?.trim()) {
    alertMessage =
      "Select a workspace in the navigation bar, or switch to Group and pick a workspace group.";
  } else if (loading) {
    alertMessage =
      scopeMode === "group"
        ? "Loading knowledge graph for this group..."
        : "Loading knowledge graph...";
  } else if (error) {
    alertMessage = error;
  } else if (allNodes.length === 0 && allEdges.length === 0) {
    alertMessage =
      scopeMode === "group"
        ? "No knowledge graph data for this group. Add workspaces to the group and ensure documents are uploaded and preprocessing is complete."
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
      (scopeMode === "group" && selectedGroupWorkspaces.size === 0))
  ) {
    alertMessage =
      scopeMode === "group" && selectedGroupWorkspaces.size === 0
        ? "Select at least one workspace in the group to display the graph."
        : "Please select node types and/or source files to display the graph.";
  } else if (
    filteredNodes.length === 0 &&
    (hasFiltersBeenInteracted ||
      isSearchMode ||
      selectedNodeTypes.size > 0 ||
      selectedSourceFiles.size > 0 ||
      (scopeMode === "group" && workspaceFilterActive))
  ) {
    alertMessage =
      "No graph data matches your current filters. Adjust filters or use Clear all filters.";
  } else if (filteredNodes.length === 0) {
    alertMessage =
      scopeMode === "group"
        ? "No graph data for this group. Ensure documents are uploaded and preprocessing is complete."
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
            {scopeMode === "group" ? (
              <>
                <Users className="mr-1 inline h-3 w-3" />
                {activeGroup
                  ? workspaceFilterActive
                    ? `${selectedGroupWorkspaces.size} of ${groupMemberCount} in ${activeGroup}`
                    : groupMemberCount > 0
                      ? selectedGroupWorkspaces.size >= groupMemberCount
                        ? `All ${groupMemberCount} in ${activeGroup}`
                        : `${selectedGroupWorkspaces.size} of ${groupMemberCount} in ${activeGroup}`
                      : `Group: ${activeGroup} (empty)`
                  : "No group selected"}
              </>
            ) : (
              <>
                <FolderOpen className="mr-1 inline h-3 w-3" />
                {currentWorkspace?.trim() || "No workspace"}
              </>
            )}
          </Badge>
        </div>

        <GroupScopeSelector
          disabled={loading}
          onScopeChange={() => {
            setSelectedGroupWorkspaces(new Set());
            setActiveFilterPanel("none");
            setSelectedItem(null);
          }}
        />
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden p-4">
      {graphReady ? (
        <div ref={graphContainerRef} className="relative h-full w-full overflow-hidden rounded-lg border bg-card shadow-lg">
          <InteractiveGraphVisualization
            nodes={allNodes}
            edges={allEdges}
            visibleNodeIds={graphVisibleNodeIds}
            onSelect={(node) => {
              setSelectedItem(node);
              if (node) closeKbFloatingPanels();
            }}
            selectedItem={selectedItem}
            onGraphBackgroundClick={closeAllFilterPanels}
            showControls={allNodes.length > 0}
            graphControlsOpen={graphControlsOpen}
            onGraphControlsOpenChange={handleGraphControlsOpenChange}
            viewResetKey={graphViewResetKey}
            focusDepth={Math.min(3, Math.max(1, graphLoadParams.depth))}
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
                limitMax={
                  scopeMode === "group" ? kbMaxLimitForGroup(limitDivisor) : KB_MAX_LIMIT
                }
                limitDefaultHint={
                  scopeMode === "group"
                    ? kbDefaultLimitForGroup(limitDivisor)
                    : KB_DEFAULT_LIMIT
                }
                limitPerWorkspace={scopeMode === "group"}
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
              {scopeMode === "group" && groupWorkspaceNames.length > 0 && (
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

            <div
              className="pointer-events-auto absolute right-0 top-0 z-[100]"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <EntityTypeLegendDropdown
                items={entityTypeLegendItems}
                disabled={loading}
              />
            </div>
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
            {activeFilterPanel === "workspaces" && scopeMode === "group" && (
              <GroupWorkspacesPanel
                nodes={allNodes}
                workspaceNames={
                  groupMemberNamesFromApi.length > 0
                    ? groupMemberNamesFromApi
                    : groupWorkspaceNames
                }
                selectedWorkspaces={selectedGroupWorkspaces}
                onSelectedWorkspacesChange={setSelectedGroupWorkspaces}
                onClose={() => setActiveFilterPanel("none")}
                onFilterInteraction={onFilterInteraction}
              />
            )}
            {activeFilterPanel === "sourceFiles" && (
              <SourceFilesPanel
                availableFiles={availableSourceFiles}
                selectedSourceFiles={selectedSourceFiles}
                onSelectedSourceFilesChange={handleSourceFilesChange}
                onClose={() => setActiveFilterPanel("none")}
                loading={loading}
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
