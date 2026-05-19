"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useWorkspace } from "@/context/WorkspaceContext";
import {
  getWorkspaces,
  getWorkspaceStats,
  getWorkspacePage,
  createWorkspace,
  deleteWorkspace,
  startPreprocess,
  WorkspaceCreateError,
  type WorkspacePageItem,
  type WorkspacePagePagination,
  type WorkspacePageFlag,
  type WorkspaceStats,
} from "@/database/workspaceStorage";
import { toast } from "sonner";
import DeleteConfirmationDialog from "@/components/DeleteConfirmationDialog";
import WorkspaceCard from "@/components/WorkspaceCard";
import WorkspaceCardSkeleton from "@/components/workspace/WorkspaceCardSkeleton";
import WorkspaceManagementToolbar, {
  type FlagFilter,
} from "@/components/workspace/WorkspaceManagementToolbar";
import { useWorkspaceGridPageSize } from "@/hooks/useWorkspaceGridPageSize";

const EMPTY_PAGINATION: WorkspacePagePagination = {
  page: 1,
  page_size: 8,
  total_items: 0,
  total_pages: 0,
  has_next: false,
  has_previous: false,
};

function flagFilterToApi(flag: FlagFilter): WorkspacePageFlag {
  if (flag === "flagged") return "flagged";
  if (flag === "unflagged") return "non_flagged";
  return "all";
}

function entryToPageItem(entry: {
  name: string;
  is_flag: boolean;
  created_at: string;
}): WorkspacePageItem {
  return {
    name: entry.name,
    is_flag: entry.is_flag,
    created_at: entry.created_at,
    counts: { files: 0, chunks: 0, entities: 0, relations: 0 },
  };
}

const WorkspaceManagement = () => {
  const { currentWorkspace, setCurrentWorkspace } = useWorkspace();
  const { gridRef, pageSize } = useWorkspaceGridPageSize();

  const [workspaces, setWorkspaces] = useState<WorkspacePageItem[]>([]);
  const [pagination, setPagination] =
    useState<WorkspacePagePagination>(EMPTY_PAGINATION);
  const [workspaceStats, setWorkspaceStats] = useState<WorkspaceStats | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);

  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [flagFilter, setFlagFilter] = useState<FlagFilter>("both");
  const [page, setPage] = useState(1);

  const [searchList, setSearchList] = useState<WorkspacePageItem[] | null>(
    null
  );
  const [isSearchListLoading, setIsSearchListLoading] = useState(false);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<string | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExtractingMap, setIsExtractingMap] = useState<Map<string, boolean>>(
    new Map()
  );

  const prevPageSizeRef = useRef(pageSize);
  const isSearchActive = debouncedSearch.trim().length > 0;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, flagFilter]);

  useEffect(() => {
    if (prevPageSizeRef.current !== pageSize) {
      prevPageSizeRef.current = pageSize;
      setPage(1);
    }
  }, [pageSize]);

  const fetchStats = useCallback(async () => {
    try {
      const stats = await getWorkspaceStats();
      setWorkspaceStats(stats);
    } catch (error) {
      console.error("Failed to fetch workspace stats:", error);
    }
  }, []);

  const syncCurrentWorkspaceFromPage = useCallback(
    (items: WorkspacePageItem[]) => {
      if (!currentWorkspace && items.length > 0) {
        setCurrentWorkspace(items[0].name);
      }
    },
    [currentWorkspace, setCurrentWorkspace]
  );

  useEffect(() => {
    let cancelled = false;
    getWorkspaces().then((list) => {
      if (cancelled) return;
      const names = list.map((w) => w.name);
      if (currentWorkspace && !names.includes(currentWorkspace)) {
        setCurrentWorkspace(names[0] ?? null);
      } else if (!currentWorkspace && names.length > 0) {
        setCurrentWorkspace(names[0]);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- validate once on mount
  }, []);

  const fetchPage = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getWorkspacePage({
        page,
        page_size: pageSize,
        flag: flagFilterToApi(flagFilter),
      });
      setWorkspaces(response.workspaces);
      setPagination(response.pagination);
      syncCurrentWorkspaceFromPage(response.workspaces);
    } catch (error) {
      console.error("Failed to fetch workspace page:", error);
      toast.error("Failed to load workspaces.");
      setWorkspaces([]);
      setPagination(EMPTY_PAGINATION);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, flagFilter, syncCurrentWorkspaceFromPage]);

  const fetchSearchList = useCallback(async () => {
    setIsSearchListLoading(true);
    try {
      const list = await getWorkspaces();
      const apiFlag = flagFilterToApi(flagFilter);
      let filtered = list.map(entryToPageItem);
      if (apiFlag === "flagged") {
        filtered = filtered.filter((w) => w.is_flag);
      } else if (apiFlag === "non_flagged") {
        filtered = filtered.filter((w) => !w.is_flag);
      }
      const q = debouncedSearch.trim().toLowerCase();
      if (q) {
        filtered = filtered.filter((w) =>
          w.name.toLowerCase().includes(q)
        );
      }
      filtered.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setSearchList(filtered);
    } catch (error) {
      console.error("Failed to load workspaces for search:", error);
      toast.error("Failed to search workspaces.");
      setSearchList([]);
    } finally {
      setIsSearchListLoading(false);
    }
  }, [debouncedSearch, flagFilter]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (isSearchActive) {
      setSearchList(null);
      fetchSearchList();
    } else {
      setSearchList(null);
    }
  }, [isSearchActive, fetchSearchList]);

  useEffect(() => {
    if (!isSearchActive) {
      fetchPage();
    }
  }, [isSearchActive, fetchPage]);

  const searchPagination = useMemo(() => {
    if (!isSearchActive || searchList === null) {
      return EMPTY_PAGINATION;
    }
    const total_items = searchList.length;
    const total_pages = Math.max(1, Math.ceil(total_items / pageSize));
    const safePage = Math.min(page, total_pages);
    return {
      page: safePage,
      page_size: pageSize,
      total_items,
      total_pages,
      has_next: safePage < total_pages,
      has_previous: safePage > 1,
    };
  }, [isSearchActive, searchList, pageSize, page]);

  const displayedWorkspaces = useMemo(() => {
    if (!isSearchActive) return workspaces;
    if (searchList === null) return [];
    const { page: p, page_size } = searchPagination;
    const start = (p - 1) * page_size;
    return searchList.slice(start, start + page_size);
  }, [isSearchActive, workspaces, searchList, searchPagination]);

  const activePagination = isSearchActive ? searchPagination : pagination;

  useEffect(() => {
    if (
      activePagination.total_pages > 0 &&
      page > activePagination.total_pages
    ) {
      setPage(activePagination.total_pages);
    }
  }, [activePagination.total_pages, page]);

  const showLoading = isSearchActive ? isSearchListLoading : isLoading;
  const isInitialGridLoad = showLoading && displayedWorkspaces.length === 0;
  const hasNoWorkspacesEver =
    workspaceStats !== null && workspaceStats.total === 0;

  const refreshAfterMutation = useCallback(async () => {
    await fetchStats();
    if (isSearchActive) {
      await fetchSearchList();
    } else {
      await fetchPage();
    }
  }, [fetchStats, fetchPage, fetchSearchList, isSearchActive]);

  const handleCreateWorkspace = async () => {
    const name = newWorkspaceName.trim();
    if (!name) {
      toast.error("Workspace name cannot be empty.");
      return;
    }

    setIsCreating(true);
    const loadingToastId = toast.loading(`Creating workspace "${name}"...`);

    try {
      await createWorkspace(name);
      toast.success(`Workspace "${name}" created successfully!`, {
        id: loadingToastId,
      });
      setNewWorkspaceName("");
      setPage(1);
      await fetchStats();
      if (isSearchActive) {
        await fetchSearchList();
      } else {
        const response = await getWorkspacePage({
          page: 1,
          page_size: pageSize,
          flag: flagFilterToApi(flagFilter),
        });
        setWorkspaces(response.workspaces);
        setPagination(response.pagination);
      }
      setCurrentWorkspace(name);
    } catch (error) {
      const errorMessage =
        error instanceof WorkspaceCreateError
          ? error.message
          : error instanceof Error
            ? error.message
            : "An unexpected error occurred.";
      toast.error(`Failed to create workspace: ${errorMessage}`, {
        id: loadingToastId,
      });
      console.error("Error creating workspace:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectWorkspace = (workspaceName: string) => {
    setCurrentWorkspace(workspaceName);
    toast.success(`Switched to workspace: ${workspaceName}`);
  };

  const handleDeleteClick = (workspaceName: string) => {
    setWorkspaceToDelete(workspaceName);
    setIsDeleteDialogOpen(true);
  };

  const executeDeleteWorkspace = useCallback(async () => {
    if (!workspaceToDelete) return;

    setIsDeleting(true);
    const loadingToastId = toast.loading(
      `Deleting workspace ${workspaceToDelete}...`
    );

    try {
      await deleteWorkspace(workspaceToDelete);
      toast.success(`Workspace "${workspaceToDelete}" deleted successfully!`, {
        id: loadingToastId,
      });
      if (currentWorkspace === workspaceToDelete) {
        setCurrentWorkspace(null);
      }
      await refreshAfterMutation();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown error during deletion.";
      toast.error(`Deletion failed: ${errorMessage}`, { id: loadingToastId });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setWorkspaceToDelete(null);
    }
  }, [workspaceToDelete, currentWorkspace, setCurrentWorkspace, refreshAfterMutation]);

  const handleExtract = useCallback(
    async (workspaceName: string) => {
      setIsExtractingMap((prev) => new Map(prev).set(workspaceName, true));
      const loadingToastId = toast.loading(
        `Starting extraction for workspace "${workspaceName}"...`
      );

      try {
        await startPreprocess(workspaceName);
        toast.success(`Extraction started for "${workspaceName}"!`, {
          id: loadingToastId,
        });
        await refreshAfterMutation();
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.";
        toast.error(`Failed to start extraction: ${errorMessage}`, {
          id: loadingToastId,
        });
        console.error("Extraction error:", error);
      } finally {
        setIsExtractingMap((prev) => new Map(prev).set(workspaceName, false));
      }
    },
    [refreshAfterMutation]
  );

  const handlePreviousPage = () => {
    setPage((p) => Math.max(1, p - 1));
  };

  const handleNextPage = () => {
    setPage((p) => Math.min(activePagination.total_pages, p + 1));
  };

  const skeletonCount = Math.max(4, pageSize);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col w-full">
      <div className="flex flex-1 min-h-0 flex-col rounded-xl border shadow-lg bg-card overflow-hidden">
        <WorkspaceManagementToolbar
          newWorkspaceName={newWorkspaceName}
          onNewWorkspaceNameChange={setNewWorkspaceName}
          onCreateWorkspace={handleCreateWorkspace}
          isCreating={isCreating}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          flagFilter={flagFilter}
          onFlagFilterChange={setFlagFilter}
          workspaceStats={workspaceStats}
          totalItems={activePagination.total_items}
          page={activePagination.page}
          totalPages={Math.max(1, activePagination.total_pages)}
          hasPrevious={activePagination.has_previous}
          hasNext={activePagination.has_next}
          onPreviousPage={handlePreviousPage}
          onNextPage={handleNextPage}
          isSearchActive={isSearchActive}
        />

        <div
          ref={gridRef}
          className="flex-1 min-h-0 overflow-y-auto p-4"
        >
          {isInitialGridLoad ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from({ length: skeletonCount }).map((_, i) => (
                <WorkspaceCardSkeleton key={i} />
              ))}
            </div>
          ) : showLoading && displayedWorkspaces.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 auto-rows-fr opacity-50 pointer-events-none">
              {displayedWorkspaces.map((workspace) => (
                <WorkspaceCard
                  key={workspace.name}
                  workspaceName={workspace.name}
                  isCurrent={currentWorkspace === workspace.name}
                  onSelect={handleSelectWorkspace}
                  onDelete={handleDeleteClick}
                  isDeleting={isDeleting}
                  deletingWorkspaceName={workspaceToDelete}
                  counts={workspace.counts}
                  onExtract={handleExtract}
                  isExtracting={
                    isExtractingMap.get(workspace.name) || false
                  }
                  isFlagged={workspace.is_flag}
                  onFlagToggled={refreshAfterMutation}
                />
              ))}
            </div>
          ) : hasNoWorkspacesEver ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[12rem] text-center">
              <Alert className="max-w-lg">
                <Info className="h-4 w-4" />
                <AlertTitle>No Workspaces Found</AlertTitle>
                <AlertDescription>
                  You do not have any workspaces yet. Enter a name above and
                  click Create to get started.
                </AlertDescription>
              </Alert>
            </div>
          ) : activePagination.total_items === 0 ? (
            <div className="flex items-center justify-center h-full min-h-[12rem] text-muted-foreground text-lg">
              <p>No workspaces match your current filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 auto-rows-fr">
              {displayedWorkspaces.map((workspace) => (
                <WorkspaceCard
                  key={workspace.name}
                  workspaceName={workspace.name}
                  isCurrent={currentWorkspace === workspace.name}
                  onSelect={handleSelectWorkspace}
                  onDelete={handleDeleteClick}
                  isDeleting={isDeleting}
                  deletingWorkspaceName={workspaceToDelete}
                  counts={workspace.counts}
                  onExtract={handleExtract}
                  isExtracting={
                    isExtractingMap.get(workspace.name) || false
                  }
                  isFlagged={workspace.is_flag}
                  onFlagToggled={refreshAfterMutation}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {workspaceToDelete && (
        <DeleteConfirmationDialog
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          onConfirm={executeDeleteWorkspace}
          title={`Permanently Delete Workspace: ${workspaceToDelete}`}
          description={`This action will permanently delete the workspace "${workspaceToDelete}" and all associated documents and data. This action cannot be undone.`}
          itemName={workspaceToDelete}
        />
      )}
    </div>
  );
};

export default WorkspaceManagement;
