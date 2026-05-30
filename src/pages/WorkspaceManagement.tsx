"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useWorkspace } from "@/context/WorkspaceContext";
import {
  getAllWorkspaces,
  getWorkspaceStats,
  createWorkspace,
  addWorkspaceToGroup,
  deleteWorkspaces,
  startPreprocess,
  summarizePreprocessStart,
  WorkspaceCreateError,
  type WorkspacePageItem,
  type WorkspaceStats,
} from "@/database/workspaceStorage";
import { toast } from "sonner";
import DeleteConfirmationDialog from "@/components/DeleteConfirmationDialog";
import WorkspaceCard from "@/components/WorkspaceCard";
import WorkspaceCardSkeleton from "@/components/workspace/WorkspaceCardSkeleton";
import WorkspaceManagementToolbar from "@/components/workspace/WorkspaceManagementToolbar";
import PreprocessQueueStatusPanel from "@/components/workspace/PreprocessQueueStatusPanel";
import CreateWorkspaceDialog from "@/components/workspace/CreateWorkspaceDialog";
import ManageGroupsDialog from "@/components/workspace/ManageGroupsDialog";
import { useWorkspaceGridPageSize } from "@/hooks/useWorkspaceGridPageSize";
import { useWorkspaceDirectory } from "@/hooks/useWorkspaceDirectory";

const WorkspaceManagement = () => {
  const { currentWorkspace, setCurrentWorkspace, groups, refreshGroups } =
    useWorkspace();
  const { gridRef, pageSize } = useWorkspaceGridPageSize();

  const [workspaceStats, setWorkspaceStats] = useState<WorkspaceStats | null>(
    null
  );

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [groupsDialogOpen, setGroupsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [workspacesToDelete, setWorkspacesToDelete] = useState<string[]>([]);
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExtractingMap, setIsExtractingMap] = useState<Map<string, boolean>>(
    new Map()
  );
  const [groupsByWorkspace, setGroupsByWorkspace] = useState<
    Record<string, string[]>
  >({});

  const prevPageSizeRef = useRef(pageSize);

  const {
    workspaces: displayedWorkspaces,
    pagination: activePagination,
    isInitialLoading,
    isPaging,
    isSearchActive,
    invalidateCache,
    reload,
  } = useWorkspaceDirectory({
    page,
    pageSize,
    groupFilter,
    searchQuery: debouncedSearch,
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, groupFilter]);

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

  const syncGroupsFromList = useCallback(async () => {
    try {
      const list = await getAllWorkspaces();
      const map: Record<string, string[]> = {};
      for (const w of list) {
        map[w.name] = w.groups ?? [];
      }
      setGroupsByWorkspace(map);
      return list;
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    syncGroupsFromList().then((list) => {
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

  useEffect(() => {
    if (displayedWorkspaces.length === 0) return;
    setCurrentWorkspace((prev) => prev ?? displayedWorkspaces[0].name);
  }, [displayedWorkspaces, setCurrentWorkspace]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (
      activePagination.total_pages > 0 &&
      page > activePagination.total_pages
    ) {
      setPage(activePagination.total_pages);
    }
  }, [activePagination.total_pages, page]);

  const displayedWorkspaceNames = useMemo(
    () => displayedWorkspaces.map((workspace) => workspace.name),
    [displayedWorkspaces]
  );

  useEffect(() => {
    setSelectedWorkspaces((prev) => {
      const next = new Set<string>();
      for (const name of prev) {
        if (displayedWorkspaceNames.includes(name)) next.add(name);
      }
      return next;
    });
  }, [displayedWorkspaceNames.join("\0")]);

  const allDisplayedSelected =
    displayedWorkspaceNames.length > 0 &&
    displayedWorkspaceNames.every((name) => selectedWorkspaces.has(name));
  const someSelected = selectedWorkspaces.size > 0;

  const toggleWorkspaceSelection = (workspaceName: string, checked: boolean) => {
    setSelectedWorkspaces((prev) => {
      const next = new Set(prev);
      if (checked) next.add(workspaceName);
      else next.delete(workspaceName);
      return next;
    });
  };

  const toggleSelectAllDisplayed = (checked: boolean) => {
    setSelectedWorkspaces(
      checked ? new Set(displayedWorkspaceNames) : new Set()
    );
  };

  const isInitialGridLoad =
    isInitialLoading && displayedWorkspaces.length === 0;
  const hasNoWorkspacesEver =
    workspaceStats !== null && workspaceStats.total === 0;

  const clearSelection = () => setSelectedWorkspaces(new Set());

  const refreshAfterMutation = useCallback(async () => {
    await fetchStats();
    await syncGroupsFromList();
    await refreshGroups();
    invalidateCache();
    reload();
  }, [
    fetchStats,
    syncGroupsFromList,
    refreshGroups,
    invalidateCache,
    reload,
  ]);

  const groupsForCard = (workspace: WorkspacePageItem): string[] =>
    (workspace.groups ?? groupsByWorkspace[workspace.name] ?? []).filter(
      (g) => g !== "flagged"
    );

  const handleCreateWorkspace = async (name: string, groupNames: string[]) => {
    setIsCreating(true);
    const loadingToastId = toast.loading(`Creating workspace "${name}"...`);

    try {
      await createWorkspace(name);
      for (const groupName of groupNames) {
        try {
          await addWorkspaceToGroup(groupName, name);
        } catch (err) {
          console.warn(`Failed to add ${name} to group ${groupName}:`, err);
          toast.error(
            `Workspace created but could not add to group "${groupName}".`
          );
        }
      }
      toast.success(`Workspace "${name}" created successfully!`, {
        id: loadingToastId,
      });
      setCreateDialogOpen(false);
      setPage(1);
      await fetchStats();
      await syncGroupsFromList();
      await refreshGroups();
      invalidateCache();
      reload();
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
    setWorkspacesToDelete([workspaceName]);
    setIsDeleteDialogOpen(true);
  };

  const handleBulkDeleteClick = () => {
    if (selectedWorkspaces.size === 0) return;
    setWorkspacesToDelete(Array.from(selectedWorkspaces));
    setIsDeleteDialogOpen(true);
  };

  const executeDeleteWorkspaces = useCallback(async () => {
    if (workspacesToDelete.length === 0) return;

    setIsDeleting(true);
    const loadingToastId = toast.loading(
      workspacesToDelete.length === 1
        ? `Deleting workspace ${workspacesToDelete[0]}...`
        : `Deleting ${workspacesToDelete.length} workspaces...`
    );

    try {
      const result = await deleteWorkspaces(workspacesToDelete);
      if (result.failed.length === 0) {
        toast.success(
          workspacesToDelete.length === 1
            ? `Workspace "${workspacesToDelete[0]}" deleted successfully!`
            : `${result.succeeded.length} workspaces deleted successfully!`,
          { id: loadingToastId }
        );
      } else if (result.succeeded.length === 0) {
        toast.error(`Deletion failed: ${result.failed[0]?.error ?? "Unknown error"}`, {
          id: loadingToastId,
        });
      } else {
        toast.warning(
          `${result.succeeded.length} deleted, ${result.failed.length} failed.`,
          { id: loadingToastId }
        );
      }

      if (result.succeeded.includes(currentWorkspace ?? "")) {
        setCurrentWorkspace(null);
      }
      if (result.succeeded.length > 0) {
        clearSelection();
        await refreshAfterMutation();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown error during deletion.";
      toast.error(`Deletion failed: ${errorMessage}`, { id: loadingToastId });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setWorkspacesToDelete([]);
    }
  }, [workspacesToDelete, currentWorkspace, setCurrentWorkspace, refreshAfterMutation]);

  const handleExtract = useCallback(
    async (workspaceName: string) => {
      setIsExtractingMap((prev) => new Map(prev).set(workspaceName, true));
      const loadingToastId = toast.loading(
        `Starting extraction for workspace "${workspaceName}"...`
      );

      try {
        const result = await startPreprocess(workspaceName);
        toast.success(summarizePreprocessStart(result), {
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

  const allWorkspaceNames = useMemo(
    () => Object.keys(groupsByWorkspace).sort((a, b) => a.localeCompare(b)),
    [groupsByWorkspace]
  );

  const groupNames = useMemo(() => groups.map((g) => g.name), [groups]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col w-full">
      <div className="flex flex-1 min-h-0 flex-col rounded-xl border shadow-lg bg-card overflow-hidden">
        <WorkspaceManagementToolbar
          onOpenCreateWorkspace={() => setCreateDialogOpen(true)}
          onOpenManageGroups={() => setGroupsDialogOpen(true)}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          groupFilter={groupFilter}
          onGroupFilterChange={setGroupFilter}
          groupNames={groupNames}
          workspaceStats={workspaceStats}
          totalItems={activePagination.total_items}
          page={activePagination.page}
          totalPages={Math.max(1, activePagination.total_pages)}
          hasPrevious={activePagination.has_previous}
          hasNext={activePagination.has_next}
          onPreviousPage={handlePreviousPage}
          onNextPage={handleNextPage}
          isSearchActive={isSearchActive}
          selectedCount={selectedWorkspaces.size}
          allDisplayedSelected={allDisplayedSelected}
          someSelected={someSelected}
          onToggleSelectAllDisplayed={toggleSelectAllDisplayed}
          onBulkDelete={handleBulkDeleteClick}
          onClearSelection={clearSelection}
          isDeleting={isDeleting}
        />

        <PreprocessQueueStatusPanel />

        <CreateWorkspaceDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onCreate={handleCreateWorkspace}
          isCreating={isCreating}
        />

        <ManageGroupsDialog
          open={groupsDialogOpen}
          onOpenChange={setGroupsDialogOpen}
          workspaceNames={allWorkspaceNames}
          onChanged={() => void refreshAfterMutation()}
        />

        <div
          ref={gridRef}
          className="relative flex-1 min-h-0 overflow-y-auto p-4"
        >
          {isPaging && !isInitialGridLoad ? (
            <div
              className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-muted"
              aria-hidden
            >
              <div className="h-full w-1/3 animate-pulse bg-primary/60" />
            </div>
          ) : null}

          {isInitialGridLoad ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from({ length: skeletonCount }).map((_, i) => (
                <WorkspaceCardSkeleton key={i} />
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
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 auto-rows-fr transition-opacity duration-150 ${
                isPaging ? "opacity-90" : ""
              }`}
            >
              {displayedWorkspaces.map((workspace) => (
                <WorkspaceCard
                  key={workspace.name}
                  workspaceName={workspace.name}
                  isCurrent={currentWorkspace === workspace.name}
                  onSelect={handleSelectWorkspace}
                  onDelete={handleDeleteClick}
                  isDeleting={isDeleting}
                  deletingWorkspaceName={
                    workspacesToDelete.length === 1 ? workspacesToDelete[0] : null
                  }
                  isSelected={selectedWorkspaces.has(workspace.name)}
                  onSelectionChange={(checked) =>
                    toggleWorkspaceSelection(workspace.name, checked)
                  }
                  showSelection={displayedWorkspaces.length > 0}
                  counts={workspace.counts}
                  onExtract={handleExtract}
                  isExtracting={
                    isExtractingMap.get(workspace.name) || false
                  }
                  groups={groupsForCard(workspace)}
                  onGroupsChanged={refreshAfterMutation}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {workspacesToDelete.length > 0 && (
        <DeleteConfirmationDialog
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          onConfirm={executeDeleteWorkspaces}
          title={
            workspacesToDelete.length === 1
              ? "Permanently Delete Workspace"
              : `Permanently Delete ${workspacesToDelete.length} Workspaces`
          }
          description={
            workspacesToDelete.length === 1
              ? `This action will permanently delete the workspace "${workspacesToDelete[0]}" and all associated documents and data. This action cannot be undone.`
              : `This action will permanently delete ${workspacesToDelete.length} workspaces and all associated documents and data. This action cannot be undone.`
          }
          itemName={workspacesToDelete.length === 1 ? workspacesToDelete[0] : undefined}
          itemNames={workspacesToDelete.length > 1 ? workspacesToDelete : undefined}
        />
      )}
    </div>
  );
};

export default WorkspaceManagement;
