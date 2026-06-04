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
  LayoutGrid,
} from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useResolvedScopeOwner } from "@/hooks/useResolvedScopeOwner";
import { InteractiveGraphVisualization } from "@/components/InteractiveGraphVisualization";
import SourceFilesPanel from "@/components/SourceFilesPanel";
import GraphEntitySearchBar from "@/components/GraphEntitySearchBar";
import GroupWorkspacesPanel from "@/components/GroupWorkspacesPanel";
import GroupOverviewTable from "@/components/knowledge-base/GroupOverviewTable";
import GroupScopeSelector from "@/components/scope/GroupScopeSelector";
import DetailPanel from "@/components/DetailPanel";
import { KbGraphSidePanel } from "@/components/knowledge-base/KbGraphSidePanel";
import { EntityTypeLegendDropdown } from "@/components/knowledge-base/EntityTypeLegendDropdown";
import { collectGraphWorkspaceNames, getGraphNodeWorkspace } from "@/lib/graphWorkspace";
import {
  graphLabelHintMessage,
  type GraphLabelProfile,
} from "@/lib/graphLabelPolicy";
import { getStoredGraphConfig } from "@/lib/graphSimulationConfig";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  getKnowledgeGraphEntityTypes,
  getFilteredKnowledgeGraph,
  fetchKnowledgeGraphForWorkspaces,
  resolveGroupKgScopeMeta,
  groupScope,
  workspaceScope,
  listFiles,
  listFilesForWorkspaces,
  resolveGraphFileNamesParam,
  searchKnowledgeEntities,
  topEntityTypesByCount,
  type GroupTag,
  KB_DEFAULT_DEPTH,
  KB_DEFAULT_LIMIT,
  KB_MAX_LIMIT,
  KB_MAX_GROUP_GRAPH_WORKSPACES,
  KB_DEFAULT_GROUP_SELECTION,
  kbDefaultLimitForGroup,
  kbMaxLimitForGroup,
  groupLimitDivisor,
  KB_DEFAULT_SEARCH_THRESHOLD,
  KB_INITIAL_TYPE_COUNT,
  isLargeGroup,
  defaultGroupWorkspaceSelection,
  type EntityTypeEntry,
  type EntitySearchMatch,
  type GroupWorkspaceEntitySummary,
  GraphNode,
  GraphEdge,
} from "@/database/workspaceStorage";
import { GraphLoadControls, type GraphLoadParams } from "@/components/GraphLoadControls";
import { scopedGraphNodeId } from "@/lib/graphWorkspace";
import type { ViewScopeMode } from "@/lib/viewScope";
import { showError } from "@/utils/toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { brand } from "@/lib/brandColors";
import { formatGroupMemberCount, formatGroupTag, groupKgEmptyMessage } from "@/lib/groupTag";

type ActiveFilterPanel = "none" | "sourceFiles" | "workspaces" | "overview";

const KnowledgeBase = () => {
  console.log("KnowledgeBase: Component rendered.");
  const { currentWorkspace, scopeMode, activeGroup, scopeHydrated } = useWorkspace();
  const {
    owner: scopeOwner,
    needsOwner: scopeNeedsOwner,
    ready: scopeOwnerReady,
  } = useResolvedScopeOwner();
  const [allNodes, setAllNodes] = useState<GraphNode[]>([]);
  const [allEdges, setAllEdges] = useState<GraphEdge[]>([]);
  const [scopeLoading, setScopeLoading] = useState(true);
  const [graphLoading, setGraphLoading] = useState(false);
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
  const lastBootstrappedKeyRef = useRef<string | null>(null);
  const scopeLoadRequestIdRef = useRef(0);

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
  const [activeGroupTag, setActiveGroupTag] = useState<GroupTag>("workspace");
  const [groupMemberNamesFromApi, setGroupMemberNamesFromApi] = useState<string[]>([]);
  const [groupWorkspaceSummaries, setGroupWorkspaceSummaries] = useState<
    GroupWorkspaceEntitySummary[]
  >([]);
  const [overviewSelectedWorkspace, setOverviewSelectedWorkspace] = useState<string | null>(
    null
  );
  const [graphZoomK, setGraphZoomK] = useState(1);

  const selectedGroupWorkspacesRef = useRef(selectedGroupWorkspaces);
  selectedGroupWorkspacesRef.current = selectedGroupWorkspaces;
  const groupMemberCountRef = useRef(groupMemberCount);
  groupMemberCountRef.current = groupMemberCount;
  const groupMemberNamesFromApiRef = useRef(groupMemberNamesFromApi);
  groupMemberNamesFromApiRef.current = groupMemberNamesFromApi;
  const groupIsWorkspaceTagRef = useRef(true);
  const activeGroupTagRef = useRef(activeGroupTag);
  activeGroupTagRef.current = activeGroupTag;

  const scopeLoadKey = useMemo(() => {
    const ownerKey =
      scopeOwner?.ownerId != null
        ? String(scopeOwner.ownerId)
        : (scopeOwner?.ownerUsername ?? "");
    return scopeMode === "group"
      ? `group:${activeGroup ?? ""}:${ownerKey}:${refreshCounter}`
      : `workspace:${currentWorkspace ?? ""}:${ownerKey}:${refreshCounter}`;
  }, [scopeMode, activeGroup, currentWorkspace, refreshCounter, scopeOwner]);

  const loading = scopeLoading || graphLoading;

  const groupWorkspaceNames = useMemo(
    () => (scopeMode === "group" ? collectGraphWorkspaceNames(allNodes) : []),
    [scopeMode, allNodes]
  );

  const workspaceFilterActive = useMemo(
    () =>
      scopeMode === "group" &&
      activeGroupTag === "workspace" &&
      groupMemberNamesFromApi.length > 0 &&
      selectedGroupWorkspaces.size > 0 &&
      selectedGroupWorkspaces.size < groupMemberNamesFromApi.length &&
      hasFiltersBeenInteracted,
    [
      scopeMode,
      activeGroupTag,
      groupMemberNamesFromApi.length,
      selectedGroupWorkspaces.size,
      hasFiltersBeenInteracted,
    ]
  );

  const groupWorkspaceCount = Math.max(1, groupMemberNamesFromApi.length);

  const limitDivisor = useMemo(() => {
    if (scopeMode !== "group") return 1;
    return groupLimitDivisor(
      groupWorkspaceCount,
      selectedGroupWorkspaces.size || groupWorkspaceCount,
      workspaceFilterActive
    );
  }, [
    scopeMode,
    groupWorkspaceCount,
    selectedGroupWorkspaces.size,
    workspaceFilterActive,
  ]);

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
    lastBootstrappedKeyRef.current = null;
    setAllNodes([]);
    setAllEdges([]);
    setScopeLoading(false);
    setGraphLoading(false);
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
    setActiveGroupTag("workspace");
    groupIsWorkspaceTagRef.current = true;
    setGroupMemberNamesFromApi([]);
    setGraphLoadParams({ depth: KB_DEFAULT_DEPTH, limit: KB_DEFAULT_LIMIT });
    setSelectedNodeTypes(new Set());
    setAvailableSourceFiles([]);
    setSelectedSourceFiles(new Set());
    setSelectedGroupWorkspaces(new Set());
    setGroupWorkspaceSummaries([]);
    setOverviewSelectedWorkspace(null);
  }, []);

  const resolveGroupGraphTargets = useCallback((): {
    names: string[];
    error?: string;
  } => {
    if (scopeMode !== "group" || !groupIsWorkspaceTagRef.current) {
      return { names: [] };
    }
    const names = [...selectedGroupWorkspaces].sort((a, b) => a.localeCompare(b));
    if (names.length === 0) {
      return {
        names: [],
        error: `Select at least one workspace (max ${KB_MAX_GROUP_GRAPH_WORKSPACES}), then click Load graph.`,
      };
    }
    if (names.length > KB_MAX_GROUP_GRAPH_WORKSPACES) {
      return {
        names: [],
        error: `Select at most ${KB_MAX_GROUP_GRAPH_WORKSPACES} workspaces for one merged graph.`,
      };
    }
    return { names };
  }, [scopeMode, selectedGroupWorkspaces]);

  const loadGroupSourceFiles = useCallback(
    async (workspaceNames: string[]) => {
      if (workspaceNames.length === 0) {
        setAvailableSourceFiles([]);
        setSelectedSourceFiles(new Set());
        return [];
      }
      const files = await listFilesForWorkspaces(workspaceNames, { owner: scopeOwner });
      setAvailableSourceFiles(files);
      setSelectedSourceFiles(new Set(files));
      return files;
    },
    [scopeOwner]
  );

  const loadBrowseGraph = useCallback(
    async (
      mode: ViewScopeMode,
      workspaceName: string | null,
      groupName: string | null,
      types: Set<string>,
      loadParams: GraphLoadParams,
      fileCatalog: string[],
      selectedFiles: Set<string>,
      options?: {
        groupMemberTotal?: number;
        groupTargets?: string[];
      }
    ) => {
      const requestId = scopeLoadRequestIdRef.current;

      if (types.size === 0) {
        if (requestId !== scopeLoadRequestIdRef.current) return;
        setAllNodes([]);
        setAllEdges([]);
        setTruncated(false);
        return;
      }

      if (fileCatalog.length > 0 && selectedFiles.size === 0) {
        if (requestId !== scopeLoadRequestIdRef.current) return;
        setAllNodes([]);
        setAllEdges([]);
        setTruncated(false);
        setIsSearchMode(false);
        setSearchMatches([]);
        applyGraphResponse({ nodes: [], edges: [], truncated: false });
        return;
      }

      setGraphLoading(true);
      setError(null);
      try {
        const entityTypes = Array.from(types);
        const fileNames = resolveGraphFileNamesParam(fileCatalog, selectedFiles);
        const fetchParams = {
          entityTypes,
          fileNames,
          depth: loadParams.depth,
          limit: loadParams.limit,
        };

        let data;
        if (mode === "group" && groupName) {
          if (!groupIsWorkspaceTagRef.current) {
            data = await getFilteredKnowledgeGraph(
              groupScope(groupName, scopeOwner),
              fetchParams
            );
          } else {
          const memberTotal = options?.groupMemberTotal ?? groupMemberCountRef.current;
          const sel = selectedGroupWorkspacesRef.current;
          const apiNames = groupMemberNamesFromApiRef.current;
          const targets =
            options?.groupTargets ??
            (sel.size > 0 ? [...sel] : defaultGroupWorkspaceSelection(apiNames));
          const useSubsetFetch =
            isLargeGroup(memberTotal) ||
            (targets.length > 0 && targets.length < memberTotal);

          if (useSubsetFetch) {
            if (targets.length === 0) {
              data = {
                workspace: groupName,
                group: groupName,
                nodes: [],
                edges: [],
                truncated: false,
              };
            } else {
              data = await fetchKnowledgeGraphForWorkspaces(
                targets,
                groupName,
                fetchParams,
                { owner: scopeOwner }
              );
            }
          } else {
            data = await getFilteredKnowledgeGraph(
              groupScope(groupName, scopeOwner),
              fetchParams
            );
          }
          }
        } else {
          data = await getFilteredKnowledgeGraph(
            workspaceScope(workspaceName!, scopeOwner),
            fetchParams
          );
        }
        if (requestId !== scopeLoadRequestIdRef.current) return;
        setIsSearchMode(false);
        setSearchMatches([]);
        applyGraphResponse(data);
      } catch (err: unknown) {
        if (requestId !== scopeLoadRequestIdRef.current) return;
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
        if (requestId === scopeLoadRequestIdRef.current) {
          setGraphLoading(false);
        }
      }
    },
    [applyGraphResponse, scopeOwner]
  );

  const loadEntityTypeCatalog = useCallback(
    async (
      mode: ViewScopeMode,
      workspaceName: string | null,
      groupName: string | null,
      requestId: number
    ) => {
      setScopeLoading(true);
      setError(null);
      setAllNodes([]);
      setAllEdges([]);
      setTruncated(false);
      resetBrowseUiFilters();

      try {
        if (mode === "group") {
          if (!groupName?.trim()) {
            if (requestId !== scopeLoadRequestIdRef.current) return;
            setGroupMemberCount(0);
            setActiveGroupTag("workspace");
            groupIsWorkspaceTagRef.current = true;
            setGroupMemberNamesFromApi([]);
            setEntityTypeCatalog([]);
            return;
          }
          const [entityTypesResult, kgMetaResult] = await Promise.allSettled([
            getKnowledgeGraphEntityTypes(groupScope(groupName, scopeOwner)),
            resolveGroupKgScopeMeta(groupName, scopeOwner),
          ]);
          if (requestId !== scopeLoadRequestIdRef.current) return;
          if (entityTypesResult.status === "rejected") {
            throw entityTypesResult.reason;
          }
          if (kgMetaResult.status === "rejected") {
            throw kgMetaResult.reason;
          }
          const { entityTypes, workspaces: wsSummaries } = entityTypesResult.value;
          const kgMeta = kgMetaResult.value;
          const apiWorkspaces = kgMeta.graphWorkspaceNames;
          const memberCount = kgMeta.memberCount;
          const workspaceCount = Math.max(1, apiWorkspaces.length);
          const large =
            kgMeta.isWorkspaceTagGroup && isLargeGroup(apiWorkspaces.length);
          const initialSelection = large
            ? defaultGroupWorkspaceSelection(apiWorkspaces)
            : apiWorkspaces;

          setActiveGroupTag(kgMeta.tag);
          activeGroupTagRef.current = kgMeta.tag;
          groupIsWorkspaceTagRef.current = kgMeta.isWorkspaceTagGroup;
          setGroupMemberCount(memberCount);
          setGroupMemberNamesFromApi(apiWorkspaces);
          setGroupWorkspaceSummaries(wsSummaries ?? []);
          setSelectedGroupWorkspaces(new Set(initialSelection));
          setEntityTypeCatalog(entityTypes);
          const initialTypes = new Set(topEntityTypesByCount(entityTypes, KB_INITIAL_TYPE_COUNT));
          setApiSelectedEntityTypes(initialTypes);
          const divisor = groupLimitDivisor(
            workspaceCount,
            initialSelection.length || workspaceCount,
            large
          );
          const loadParams = {
            depth: KB_DEFAULT_DEPTH,
            limit: kbDefaultLimitForGroup(divisor),
          };
          setGraphLoadParams(loadParams);

          let files: string[] = [];
          const graphTargets = kgMeta.isWorkspaceTagGroup ? initialSelection : [];

          if (kgMeta.tag === "files" && kgMeta.memberFileNames.length > 0) {
            files = kgMeta.memberFileNames;
          } else if (kgMeta.isWorkspaceTagGroup && graphTargets.length > 0) {
            files = await listFilesForWorkspaces(graphTargets);
          }
          if (requestId !== scopeLoadRequestIdRef.current) return;
          setAvailableSourceFiles(files);
          setSelectedSourceFiles(new Set(files));

          if (initialTypes.size > 0 && memberCount > 0) {
            await loadBrowseGraph(
              mode,
              workspaceName,
              groupName,
              initialTypes,
              loadParams,
              files,
              new Set(files),
              kgMeta.isWorkspaceTagGroup
                ? { groupMemberTotal: apiWorkspaces.length, groupTargets: graphTargets }
                : { groupMemberTotal: memberCount }
            );
          }
          return;
        }

        const { entityTypes } = await getKnowledgeGraphEntityTypes(
          workspaceScope(workspaceName!, scopeOwner)
        );
        if (requestId !== scopeLoadRequestIdRef.current) return;

        setEntityTypeCatalog(entityTypes);
        const initialTypes = new Set(topEntityTypesByCount(entityTypes, KB_INITIAL_TYPE_COUNT));
        setApiSelectedEntityTypes(initialTypes);
        const loadParams = {
          depth: KB_DEFAULT_DEPTH,
          limit: KB_DEFAULT_LIMIT,
        };
        setGraphLoadParams(loadParams);

        const files = await listFiles(workspaceName!, scopeOwner);
        if (requestId !== scopeLoadRequestIdRef.current) return;
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
        if (requestId !== scopeLoadRequestIdRef.current) return;
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
        if (requestId === scopeLoadRequestIdRef.current) {
          setScopeLoading(false);
        }
      }
    },
    [loadBrowseGraph, resetBrowseUiFilters, scopeOwner]
  );

  const loadEntityTypeCatalogRef = useRef(loadEntityTypeCatalog);
  loadEntityTypeCatalogRef.current = loadEntityTypeCatalog;
  const clearGraphStateRef = useRef(clearGraphState);
  clearGraphStateRef.current = clearGraphState;

  const runSearch = useCallback(async () => {
    const q = nodeSearchQuery.trim();
    if (q.length < 2) return;
    if (scopeMode === "group" && !activeGroup) return;
    if (scopeMode === "workspace" && !currentWorkspace?.trim()) return;

    setGraphLoading(true);
    setError(null);
    try {
      const scope =
        scopeMode === "group" && activeGroup
          ? groupScope(activeGroup, scopeOwner)
          : workspaceScope(currentWorkspace!, scopeOwner);

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
      setGraphLoading(false);
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
    scopeOwner,
  ]);

  const handleClearSearch = useCallback(() => {
    resetBrowseUiFilters();
    const wsCount = Math.max(1, groupMemberNamesFromApi.length);
    const apiDivisor =
      scopeMode === "group"
        ? groupLimitDivisor(wsCount, wsCount, false)
        : 1;
    const loadParams = {
      depth: KB_DEFAULT_DEPTH,
      limit:
        scopeMode === "group" ? kbDefaultLimitForGroup(apiDivisor) : KB_DEFAULT_LIMIT,
    };
    setGraphLoadParams(loadParams);
    if (scopeMode === "group" && !groupIsWorkspaceTagRef.current) {
      void loadBrowseGraph(
        scopeMode,
        currentWorkspace ?? null,
        activeGroup,
        apiSelectedEntityTypes,
        loadParams,
        availableSourceFiles,
        selectedSourceFiles,
        { groupMemberTotal: groupMemberCount }
      );
      return;
    }
    let groupTargets: string[] | undefined;
    if (scopeMode === "group" && groupMemberNamesFromApi.length > 0) {
      groupTargets = isLargeGroup(groupMemberNamesFromApi.length)
        ? defaultGroupWorkspaceSelection(groupMemberNamesFromApi)
        : [...groupMemberNamesFromApi];
      setSelectedGroupWorkspaces(new Set(groupTargets));
    }
    if (scopeMode === "group" && groupTargets) {
      if (groupTargets.length === 0 || groupTargets.length > KB_MAX_GROUP_GRAPH_WORKSPACES) {
        showError(
          `Select between 1 and ${KB_MAX_GROUP_GRAPH_WORKSPACES} workspaces, then Load graph.`
        );
        return;
      }
      void (async () => {
        const files = await loadGroupSourceFiles(groupTargets!);
        void loadBrowseGraph(
          scopeMode,
          currentWorkspace ?? null,
          activeGroup,
          apiSelectedEntityTypes,
          loadParams,
          files,
          new Set(files),
          { groupMemberTotal: groupMemberNamesFromApi.length, groupTargets }
        );
      })();
      return;
    }
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
    loadGroupSourceFiles,
  ]);

  const handleClearAllFilters = useCallback(() => {
    const initialTypes = new Set(topEntityTypesByCount(entityTypeCatalog, KB_INITIAL_TYPE_COUNT));
    const wsCount = Math.max(1, groupMemberNamesFromApi.length);
    const apiDivisor =
      scopeMode === "group"
        ? groupLimitDivisor(wsCount, wsCount, false)
        : 1;
    const loadParams = {
      depth: KB_DEFAULT_DEPTH,
      limit:
        scopeMode === "group" ? kbDefaultLimitForGroup(apiDivisor) : KB_DEFAULT_LIMIT,
    };
    setApiSelectedEntityTypes(initialTypes);
    setGraphLoadParams(loadParams);
    resetBrowseUiFilters();
    if (scopeMode === "group" && !groupIsWorkspaceTagRef.current) {
      setSelectedSourceFiles(new Set(availableSourceFiles));
      void loadBrowseGraph(
        scopeMode,
        currentWorkspace ?? null,
        activeGroup,
        initialTypes,
        loadParams,
        availableSourceFiles,
        new Set(availableSourceFiles),
        { groupMemberTotal: groupMemberCount }
      );
      return;
    }
    let groupTargets: string[] | undefined;
    if (scopeMode === "group" && groupMemberNamesFromApi.length > 0) {
      groupTargets = isLargeGroup(groupMemberNamesFromApi.length)
        ? defaultGroupWorkspaceSelection(groupMemberNamesFromApi)
        : [...groupMemberNamesFromApi];
      setSelectedGroupWorkspaces(new Set(groupTargets));
    }
    if (scopeMode === "group" && groupTargets) {
      if (groupTargets.length === 0 || groupTargets.length > KB_MAX_GROUP_GRAPH_WORKSPACES) {
        showError(
          `Select between 1 and ${KB_MAX_GROUP_GRAPH_WORKSPACES} workspaces, then Load graph.`
        );
        return;
      }
      void (async () => {
        const files = await loadGroupSourceFiles(groupTargets!);
        void loadBrowseGraph(
          scopeMode,
          currentWorkspace ?? null,
          activeGroup,
          initialTypes,
          loadParams,
          files,
          new Set(files),
          { groupMemberTotal: groupMemberNamesFromApi.length, groupTargets }
        );
      })();
      return;
    }
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
    loadGroupSourceFiles,
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

  const handleApplyGraphLoad = useCallback(async () => {
    setHasFiltersBeenInteracted(true);
    if (scopeMode === "group") {
      if (!groupIsWorkspaceTagRef.current) {
        if (isSearchMode) {
          void runSearch();
          return;
        }
        void loadBrowseGraph(
          scopeMode,
          currentWorkspace ?? null,
          activeGroup,
          apiSelectedEntityTypes,
          graphLoadParams,
          availableSourceFiles,
          selectedSourceFiles,
          { groupMemberTotal: groupMemberCount }
        );
        return;
      }
      const { names, error } = resolveGroupGraphTargets();
      if (error) {
        showError(error);
        return;
      }
      const files = await loadGroupSourceFiles(names);
      if (isSearchMode) {
        void runSearch();
        return;
      }
      void loadBrowseGraph(
        scopeMode,
        currentWorkspace ?? null,
        activeGroup,
        apiSelectedEntityTypes,
        graphLoadParams,
        files,
        new Set(files),
        { groupMemberTotal: groupMemberNamesFromApi.length, groupTargets: names }
      );
      return;
    }
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
    resolveGroupGraphTargets,
    loadGroupSourceFiles,
    groupMemberCount,
  ]);

  const handleOverviewWorkspaceSelect = useCallback(
    async (workspaceName: string) => {
      if (!activeGroup) return;
      setOverviewSelectedWorkspace(workspaceName);
      setSelectedGroupWorkspaces(new Set([workspaceName]));
      setHasFiltersBeenInteracted(true);
      const loadParams = { depth: KB_DEFAULT_DEPTH, limit: KB_DEFAULT_LIMIT };
      setGraphLoadParams(loadParams);
      const types =
        apiSelectedEntityTypes.size > 0
          ? apiSelectedEntityTypes
          : new Set(topEntityTypesByCount(entityTypeCatalog, KB_INITIAL_TYPE_COUNT));
      if (types.size === 0) return;
      const files = await listFiles(workspaceName, scopeOwner);
      setAvailableSourceFiles(files);
      setSelectedSourceFiles(new Set(files));
      await loadBrowseGraph(
        "group",
        null,
        activeGroup,
        types,
        loadParams,
        files,
        new Set(files),
        { groupMemberTotal: groupMemberCount, groupTargets: [workspaceName] }
      );
    },
    [
      activeGroup,
      apiSelectedEntityTypes,
      entityTypeCatalog,
      loadBrowseGraph,
      groupMemberCount,
      scopeOwner,
    ]
  );

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
    if (scopeMode !== "group" || groupMemberCount < 1) {
      return;
    }

    const divisor = groupLimitDivisor(
      groupMemberCount,
      selectedGroupWorkspaces.size > 0
        ? selectedGroupWorkspaces.size
        : defaultGroupWorkspaceSelection(groupMemberNamesFromApi).length,
      hasFiltersBeenInteracted || isLargeGroup(groupMemberCount)
    );
    const defaultLimit = kbDefaultLimitForGroup(divisor);
    const maxLimit = kbMaxLimitForGroup(divisor);

    const nextLimit = Math.min(maxLimit, Math.max(1, defaultLimit));
    setGraphLoadParams((prev) => {
      if (prev.limit === nextLimit) return prev;
      return { depth: prev.depth, limit: nextLimit };
    });
  }, [
    scopeMode,
    hasFiltersBeenInteracted,
    workspaceFilterActive,
    groupMemberCount,
    groupMemberNamesFromApi,
    selectedGroupWorkspacesKey,
    selectedGroupWorkspaces.size,
  ]);

  useEffect(() => {
    setSelectedItem(null);
  }, [scopeMode, currentWorkspace, activeGroup]);

  useEffect(() => {
    if (!scopeOwnerReady) return;

    if (scopeMode === "workspace") {
      if (!currentWorkspace?.trim()) {
        scopeLoadRequestIdRef.current += 1;
        clearGraphStateRef.current();
        return;
      }
      if (lastBootstrappedKeyRef.current === scopeLoadKey) return;
      lastBootstrappedKeyRef.current = scopeLoadKey;
      const requestId = ++scopeLoadRequestIdRef.current;
      setScopeLoading(true);
      setGraphLoading(false);
      setError(null);
      setAllNodes([]);
      setAllEdges([]);
      setSelectedItem(null);
      setSelectedGroupWorkspaces(new Set());
      setActiveFilterPanel("none");
      void loadEntityTypeCatalogRef.current(
        "workspace",
        currentWorkspace,
        null,
        requestId
      );
      return;
    }
    if (!activeGroup?.trim()) {
      scopeLoadRequestIdRef.current += 1;
      clearGraphStateRef.current();
      return;
    }
    if (lastBootstrappedKeyRef.current === scopeLoadKey) return;
    lastBootstrappedKeyRef.current = scopeLoadKey;
    const requestId = ++scopeLoadRequestIdRef.current;
    setScopeLoading(true);
    setGraphLoading(false);
    setError(null);
    setAllNodes([]);
    setAllEdges([]);
    setSelectedItem(null);
    setSelectedGroupWorkspaces(new Set());
    setActiveFilterPanel("none");
    void loadEntityTypeCatalogRef.current("group", null, activeGroup, requestId);
  }, [scopeLoadKey, scopeMode, currentWorkspace, activeGroup, scopeOwnerReady]);

  const hasValidScope =
    scopeOwnerReady &&
    (scopeMode === "group"
      ? !!activeGroup?.trim()
      : !!currentWorkspace?.trim());

  const graphReady =
    hasValidScope && !error && (!scopeLoading || allNodes.length > 0);

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

  const graphDisplayNodes = filteredNodes;
  const graphDisplayEdges = filteredEdges;
  const largeGraphLayout = graphDisplayNodes.length > 100;

  const graphLabelProfile = useMemo((): GraphLabelProfile => {
    if (scopeMode === "workspace") {
      return graphDisplayNodes.length <= 50 ? "detailed" : "default";
    }
    if (
      (activeGroupTag === "workspace" && isLargeGroup(groupMemberNamesFromApi.length)) ||
      graphDisplayNodes.length > 100
    ) {
      return "compact";
    }
    return graphDisplayNodes.length > 50 ? "default" : "detailed";
  }, [scopeMode, activeGroupTag, groupMemberNamesFromApi.length, graphDisplayNodes.length]);

  const graphLabelHint = useMemo(() => {
    const cfg = getStoredGraphConfig();
    return graphLabelHintMessage({
      zoomK: graphZoomK,
      profile: graphLabelProfile,
      showLabels: cfg.showLabels,
      nodeCount: graphDisplayNodes.length,
    });
  }, [graphZoomK, graphLabelProfile, graphDisplayNodes.length]);

  const graphViewResetKey = useMemo(
    () => `${scopeMode}-${refreshCounter}-${isSearchMode}`,
    [scopeMode, refreshCounter, isSearchMode]
  );

  const groupGraphSelectionHint = useMemo(() => {
    if (
      scopeMode !== "group" ||
      activeGroupTag !== "workspace" ||
      groupMemberNamesFromApi.length <= KB_MAX_GROUP_GRAPH_WORKSPACES
    ) {
      return null;
    }
    return `This group has ${groupMemberNamesFromApi.length} workspaces. Showing the first ${KB_DEFAULT_GROUP_SELECTION} by default — open Workspaces to change selection, then Apply.`;
  }, [scopeMode, activeGroupTag, groupMemberNamesFromApi.length]);

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
  if (scopeNeedsOwner && !scopeOwner) {
    alertMessage =
      scopeMode === "group"
        ? `Multiple groups named "${activeGroup}" are visible. Choose the correct owner from the group selector in the toolbar.`
        : `Multiple workspaces named "${currentWorkspace}" are visible. Choose the correct owner from the workspace selector in the navbar.`;
  } else if (scopeMode === "workspace" && !currentWorkspace?.trim()) {
    alertMessage =
      "Select a workspace in the navigation bar, or switch to Group and pick a workspace group.";
  } else if (scopeLoading && allNodes.length === 0) {
    alertMessage =
      scopeMode === "group"
        ? "Loading knowledge graph for this group..."
        : "Loading knowledge graph...";
  } else if (graphLoading && allNodes.length === 0) {
    alertMessage =
      scopeMode === "group"
        ? "Loading graph data..."
        : "Loading graph data...";
  } else if (error) {
    alertMessage = error;
  } else if (allNodes.length === 0 && allEdges.length === 0) {
    alertMessage =
      scopeMode === "group" &&
      activeGroupTag === "workspace" &&
      isLargeGroup(groupMemberNamesFromApi.length)
        ? `This group has ${groupMemberNamesFromApi.length} workspaces. The first ${KB_DEFAULT_GROUP_SELECTION} load automatically — open Workspaces to change selection, then Apply in Graph load.`
        : scopeMode === "group"
          ? groupKgEmptyMessage(activeGroupTag)
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
      (scopeMode === "group" &&
        activeGroupTag === "workspace" &&
        selectedGroupWorkspaces.size === 0))
  ) {
    alertMessage =
      scopeMode === "group" &&
      activeGroupTag === "workspace" &&
      selectedGroupWorkspaces.size === 0
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
        ? groupKgEmptyMessage(activeGroupTag)
        : "No graph data for this workspace. Upload documents and complete preprocessing.";
  }


  const handleTogglePanel = useCallback((panelName: ActiveFilterPanel) => {
    setSearchExpanded(false);
    setGraphLoadOpen(false);
    setGraphControlsOpen(false);
    setActiveFilterPanel((prev) => (prev === panelName ? "none" : panelName));
  }, []);

  const handleGraphSelect = useCallback(
    (node: GraphNode | null) => {
      setSelectedItem(node);
      if (node) closeKbFloatingPanels();
    },
    [closeKbFloatingPanels]
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="z-10 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-background px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="shrink-0 text-base font-semibold">Knowledge graph</h1>
          {truncated && (
            <Badge variant="outline" className={cn("shrink-0 border", brand.warning.border, brand.warning.text)}>
              Subgraph truncated
            </Badge>
          )}
          {isSearchMode && (
            <Badge variant="secondary" className="shrink-0 font-normal">
              Search results
            </Badge>
          )}
          <Badge variant="secondary" className="max-w-[min(100%,22rem)] truncate font-normal">
            {scopeMode === "group" ? (
              <>
                <Users className="mr-1 inline h-3 w-3" />
                {activeGroup ? (
                  <>
                    {formatGroupTag(activeGroupTag)} · {activeGroup}
                    {groupMemberCount > 0 ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {formatGroupMemberCount({ tag: activeGroupTag, member_count: groupMemberCount })}
                      </span>
                    ) : (
                      <span className="text-muted-foreground"> (empty)</span>
                    )}
                    {activeGroupTag === "workspace" && workspaceFilterActive ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {selectedGroupWorkspaces.size}/{groupMemberNamesFromApi.length} ws
                      </span>
                    ) : null}
                  </>
                ) : (
                  "No group selected"
                )}
              </>
            ) : (
              <>
                <FolderOpen className="mr-1 inline h-3 w-3" />
                {currentWorkspace?.trim() || "No workspace"}
              </>
            )}
          </Badge>
        </div>

        <GroupScopeSelector disabled={loading} />
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden p-4">
      {graphReady ? (
        <div ref={graphContainerRef} className="relative h-full w-full overflow-hidden rounded-lg border bg-card shadow-lg">
          <InteractiveGraphVisualization
            nodes={graphDisplayNodes}
            edges={graphDisplayEdges}
            onSelect={handleGraphSelect}
            selectedItem={selectedItem}
            onGraphBackgroundClick={closeAllFilterPanels}
            showControls={graphDisplayNodes.length > 0}
            graphControlsOpen={graphControlsOpen}
            onGraphControlsOpenChange={handleGraphControlsOpenChange}
            viewResetKey={graphViewResetKey}
            focusDepth={Math.min(3, Math.max(1, graphLoadParams.depth))}
            largeGraphMode={largeGraphLayout}
            labelProfile={graphLabelProfile}
            showWorkspaceSublabel={
              scopeMode === "group" &&
              (groupMemberNamesFromApi.length > 1 || activeGroupTag !== "workspace")
            }
            onZoomChange={setGraphZoomK}
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
                selectionHint={groupGraphSelectionHint}
              />
            }
          />
          {graphLabelHint && graphDisplayNodes.length > 0 ? (
            <div
              className="pointer-events-none absolute bottom-3 right-3 z-[15] max-w-[220px] rounded-md border border-border/60 bg-background/90 px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur-sm"
              data-kb-overlay
            >
              {graphLabelHint}
            </div>
          ) : null}

          {graphLoading && allNodes.length > 0 ? (
            <div
              className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/40 backdrop-blur-[1px]"
              data-kb-overlay
            >
              <div className="flex items-center gap-2 rounded-md border bg-background/95 px-3 py-2 text-sm shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating graph…
              </div>
            </div>
          ) : null}

          {graphDisplayNodes.length === 0 && !graphLoading && (
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
              {scopeMode === "group" &&
                activeGroupTag === "workspace" &&
                groupMemberNamesFromApi.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => handleTogglePanel("overview")}
                    title={
                      activeFilterPanel === "overview"
                        ? "Hide group overview"
                        : "Group overview table"
                    }
                  >
                    {activeFilterPanel === "overview" ? (
                      <PanelLeftOpen className="h-4 w-4" />
                    ) : (
                      <LayoutGrid className="h-4 w-4" />
                    )}
                  </Button>
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
                </>
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
            {activeFilterPanel === "overview" &&
              scopeMode === "group" &&
              activeGroupTag === "workspace" && (
              <KbGraphSidePanel
                title="Group overview"
                icon={<LayoutGrid className="h-4 w-4" />}
                onClose={() => setActiveFilterPanel("none")}
              >
                <GroupOverviewTable
                  rows={groupWorkspaceSummaries}
                  selectedWorkspace={overviewSelectedWorkspace}
                  onSelectWorkspace={(ws) => void handleOverviewWorkspaceSelect(ws)}
                />
              </KbGraphSidePanel>
            )}
            {activeFilterPanel === "workspaces" &&
              scopeMode === "group" &&
              activeGroupTag === "workspace" && (
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
                memberCount={groupMemberCount}
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

          {!loading && !error && graphDisplayNodes.length > 0 && (
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
              <AlertTitle>{scopeLoading ? "Loading..." : "Information"}</AlertTitle>
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
