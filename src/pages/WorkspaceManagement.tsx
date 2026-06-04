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
  deleteWorkspace,
  updateWorkspace,
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
import CreateWorkspaceDialog, {
  type CreateWorkspaceFormValues,
} from "@/components/workspace/CreateWorkspaceDialog";
import EditWorkspaceDialog, {
  type EditWorkspaceFormValues,
} from "@/components/workspace/EditWorkspaceDialog";
import {
  directoryPageGridClass,
  directoryPagePanelClass,
  directoryPageScrollClass,
} from "@/components/directory/directoryPageStyles";
import { useWorkspaceGridPageSize } from "@/hooks/useWorkspaceGridPageSize";
import { useWorkspaceDirectory } from "@/hooks/useWorkspaceDirectory";
import { useCanViewGlobalPreprocessQueue } from "@/hooks/useCanViewPreprocessPipeline";
import {
  duplicateNamesInList,
  formatScopedResourceLabel,
  groupResourceKey,
  ownerParamsFrom,
  parseResourceKey,
  workspaceResourceKey,
} from "@/lib/ownerScope";

const WorkspaceManagement = () => {
  const showPreprocessPipeline = useCanViewGlobalPreprocessQueue();
  const {
    currentWorkspace,
    currentWorkspaceOwnerId,
    setCurrentWorkspace,
    groups,
    refreshGroups,
  } = useWorkspace();
  const { gridRef, pageSize } = useWorkspaceGridPageSize();

  const [workspaceStats, setWorkspaceStats] = useState<WorkspaceStats | null>(
    null
  );

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editWorkspaceKey, setEditWorkspaceKey] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [workspacesToDelete, setWorkspacesToDelete] = useState<WorkspacePageItem[]>(
    []
  );
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<Set<string>>(
    new Set()
  );
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
        map[workspaceResourceKey(w.name, w.owner_id)] = w.groups ?? [];
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
      if (currentWorkspace) {
        const match = list.find(
          (w) =>
            w.name === currentWorkspace &&
            (currentWorkspaceOwnerId == null ||
              w.owner_id === currentWorkspaceOwnerId)
        );
        if (!match && list.length > 0) {
          setCurrentWorkspace(list[0].name, list[0].owner_id ?? null);
        }
      } else if (list.length > 0) {
        setCurrentWorkspace(list[0].name, list[0].owner_id ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- validate once on mount
  }, []);

  useEffect(() => {
    if (displayedWorkspaces.length === 0) return;
    if (!currentWorkspace && displayedWorkspaces[0]) {
      const w = displayedWorkspaces[0];
      setCurrentWorkspace(w.name, w.owner_id ?? null);
    }
  }, [displayedWorkspaces, currentWorkspace, setCurrentWorkspace]);

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

  const duplicateWorkspaceNames = useMemo(
    () => duplicateNamesInList(displayedWorkspaces),
    [displayedWorkspaces]
  );

  const workspaceByKey = useMemo(() => {
    const map = new Map<string, WorkspacePageItem>();
    for (const w of displayedWorkspaces) {
      map.set(workspaceResourceKey(w.name, w.owner_id), w);
    }
    return map;
  }, [displayedWorkspaces]);

  const displayedWorkspaceKeys = useMemo(
    () => displayedWorkspaces.map((w) => workspaceResourceKey(w.name, w.owner_id)),
    [displayedWorkspaces]
  );

  useEffect(() => {
    setSelectedWorkspaces((prev) => {
      const next = new Set<string>();
      for (const key of prev) {
        if (displayedWorkspaceKeys.includes(key)) next.add(key);
      }
      return next;
    });
  }, [displayedWorkspaceKeys.join("\0")]);

  const allDisplayedSelected =
    displayedWorkspaceKeys.length > 0 &&
    displayedWorkspaceKeys.every((key) => selectedWorkspaces.has(key));
  const someSelected = selectedWorkspaces.size > 0;

  const toggleWorkspaceSelection = (workspaceKey: string, checked: boolean) => {
    setSelectedWorkspaces((prev) => {
      const next = new Set(prev);
      if (checked) next.add(workspaceKey);
      else next.delete(workspaceKey);
      return next;
    });
  };

  const toggleSelectAllDisplayed = (checked: boolean) => {
    setSelectedWorkspaces(
      checked ? new Set(displayedWorkspaceKeys) : new Set()
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

  const duplicateGroupNames = useMemo(
    () => duplicateNamesInList(groups),
    [groups]
  );

  const groupFilterItems = useMemo(
    () =>
      groups.map((g) => ({
        key: groupResourceKey(g.name, g.owner_id),
        label: formatScopedResourceLabel(g.name, g.owner_username, {
          duplicateNames: duplicateGroupNames,
        }),
      })),
    [groups, duplicateGroupNames]
  );

  const groupsForCard = (workspace: WorkspacePageItem): string[] =>
    (
      workspace.groups ??
      groupsByWorkspace[workspaceResourceKey(workspace.name, workspace.owner_id)] ??
      []
    ).filter((g) => g !== "flagged");

  const handleCreateWorkspace = async (values: CreateWorkspaceFormValues) => {
    setIsCreating(true);
    const loadingToastId = toast.loading(`Creating workspace "${values.name}"...`);

    try {
      await createWorkspace(values.name, {
        tag: values.tag,
        description: values.description,
      });
      const listAfterCreate = await syncGroupsFromList();
      const createdMatches = listAfterCreate.filter((w) => w.name === values.name);
      const created =
        createdMatches.length === 1
          ? createdMatches[0]
          : [...createdMatches].sort(
              (a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];
      for (const groupKey of values.groupKeys) {
        const { name: groupName, ownerId: groupOwnerId } =
          parseResourceKey(groupKey);
        const groupMeta = groups.find(
          (g) => groupResourceKey(g.name, g.owner_id) === groupKey
        );
        try {
          await addWorkspaceToGroup(groupName, values.name, {
            groupOwner:
              groupOwnerId != null ? { ownerId: groupOwnerId } : undefined,
            workspaceOwner: ownerParamsFrom(created),
          });
        } catch (err) {
          console.warn(`Failed to add ${values.name} to group ${groupName}:`, err);
          toast.error(
            `Workspace created but could not add to group "${formatScopedResourceLabel(groupName, groupMeta?.owner_username, { duplicateNames: duplicateGroupNames })}".`
          );
        }
      }
      toast.success(`Workspace "${values.name}" created successfully!`, {
        id: loadingToastId,
      });
      setCreateDialogOpen(false);
      setPage(1);
      await fetchStats();
      await refreshGroups();
      invalidateCache();
      reload();
      setCurrentWorkspace(values.name, created?.owner_id ?? null);
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

  const handleSelectWorkspace = (workspace: WorkspacePageItem) => {
    setCurrentWorkspace(workspace.name, workspace.owner_id ?? null);
    const label = formatScopedResourceLabel(
      workspace.name,
      workspace.owner_username,
      { duplicateNames: duplicateWorkspaceNames }
    );
    toast.success(`Switched to workspace: ${label}`);
  };

  const editWorkspaceMeta = useMemo(
    () => (editWorkspaceKey ? workspaceByKey.get(editWorkspaceKey) ?? null : null),
    [workspaceByKey, editWorkspaceKey]
  );

  const handleEditClick = (workspace: WorkspacePageItem) => {
    setEditWorkspaceKey(workspaceResourceKey(workspace.name, workspace.owner_id));
    setEditDialogOpen(true);
  };

  const handleSaveWorkspaceEdit = async (values: EditWorkspaceFormValues) => {
    if (!editWorkspaceKey || !editWorkspaceMeta) return;
    const editWorkspaceName = editWorkspaceMeta.name;
    setIsSavingEdit(true);
    try {
      const patch: Parameters<typeof updateWorkspace>[1] = {};
      if (values.name !== editWorkspaceName) patch.name = values.name;
      if (values.clearTag) patch.tag = null;
      else if (values.tag !== editWorkspaceMeta?.tag) patch.tag = values.tag;
      if (values.clearDescription) patch.description = null;
      else if (values.description !== editWorkspaceMeta?.description) {
        patch.description = values.description;
      }

      const owner = ownerParamsFrom(editWorkspaceMeta ?? undefined);
      const result = await updateWorkspace(editWorkspaceName, patch, owner);
      const newName = result.workspace.name;
      if (
        currentWorkspace === editWorkspaceName &&
        (currentWorkspaceOwnerId == null ||
          editWorkspaceMeta?.owner_id === currentWorkspaceOwnerId)
      ) {
        setCurrentWorkspace(newName, editWorkspaceMeta?.owner_id ?? null);
      }
      toast.success(`Workspace "${newName}" updated.`);
      setEditDialogOpen(false);
      setEditWorkspaceKey(null);
      await refreshAfterMutation();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update workspace.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteClick = (workspace: WorkspacePageItem) => {
    setWorkspacesToDelete([workspace]);
    setIsDeleteDialogOpen(true);
  };

  const handleBulkDeleteClick = () => {
    if (selectedWorkspaces.size === 0) return;
    const items = [...selectedWorkspaces]
      .map((key) => workspaceByKey.get(key))
      .filter((w): w is WorkspacePageItem => w != null);
    setWorkspacesToDelete(items);
    setIsDeleteDialogOpen(true);
  };

  const executeDeleteWorkspaces = useCallback(async () => {
    if (workspacesToDelete.length === 0) return;

    setIsDeleting(true);
    const firstLabel =
      workspacesToDelete.length === 1
        ? formatScopedResourceLabel(
            workspacesToDelete[0].name,
            workspacesToDelete[0].owner_username,
            { duplicateNames: duplicateWorkspaceNames }
          )
        : null;
    const loadingToastId = toast.loading(
      workspacesToDelete.length === 1
        ? `Deleting workspace ${firstLabel}...`
        : `Deleting ${workspacesToDelete.length} workspaces...`
    );

    try {
      const succeeded: string[] = [];
      const failed: { name: string; error: string }[] = [];
      for (const w of workspacesToDelete) {
        try {
          await deleteWorkspace(w.name, ownerParamsFrom(w));
          succeeded.push(w.name);
        } catch (error) {
          failed.push({
            name: formatScopedResourceLabel(
              w.name,
              w.owner_username,
              { duplicateNames: duplicateWorkspaceNames }
            ),
            error: error instanceof Error ? error.message : "Delete failed",
          });
        }
      }
      if (failed.length === 0) {
        toast.success(
          workspacesToDelete.length === 1
            ? `Workspace "${formatScopedResourceLabel(workspacesToDelete[0].name, workspacesToDelete[0].owner_username, { duplicateNames: duplicateWorkspaceNames })}" deleted successfully!`
            : `${succeeded.length} workspaces deleted successfully!`,
          { id: loadingToastId }
        );
      } else if (succeeded.length === 0) {
        toast.error(`Deletion failed: ${failed[0]?.error ?? "Unknown error"}`, {
          id: loadingToastId,
        });
      } else {
        toast.warning(
          `${succeeded.length} deleted, ${failed.length} failed.`,
          { id: loadingToastId }
        );
      }

      const deletedCurrent = workspacesToDelete.some(
        (w) =>
          w.name === currentWorkspace &&
          (currentWorkspaceOwnerId == null ||
            w.owner_id === currentWorkspaceOwnerId)
      );
      if (deletedCurrent) {
        setCurrentWorkspace(null, null);
      }
      if (succeeded.length > 0) {
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
  }, [
    workspacesToDelete,
    currentWorkspace,
    currentWorkspaceOwnerId,
    duplicateWorkspaceNames,
    setCurrentWorkspace,
    refreshAfterMutation,
  ]);

  const handleExtract = useCallback(
    async (workspace: WorkspacePageItem) => {
      const key = workspaceResourceKey(workspace.name, workspace.owner_id);
      setIsExtractingMap((prev) => new Map(prev).set(key, true));
      const label = formatScopedResourceLabel(
        workspace.name,
        workspace.owner_username,
        { duplicateNames: duplicateWorkspaceNames }
      );
      const loadingToastId = toast.loading(
        `Starting extraction for workspace "${label}"...`
      );

      try {
        const result = await startPreprocess(
          workspace.name,
          {},
          ownerParamsFrom(workspace)
        );
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
        setIsExtractingMap((prev) => new Map(prev).set(key, false));
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

  const deleteDialogLabels = useMemo(
    () =>
      workspacesToDelete.map((w) =>
        formatScopedResourceLabel(w.name, w.owner_username, {
          duplicateNames: duplicateWorkspaceNames,
        })
      ),
    [workspacesToDelete, duplicateWorkspaceNames]
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col w-full">
      <div className={directoryPagePanelClass}>
        <WorkspaceManagementToolbar
          onOpenCreateWorkspace={() => setCreateDialogOpen(true)}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          groupFilter={groupFilter}
          onGroupFilterChange={setGroupFilter}
          groupFilterItems={groupFilterItems}
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

        {showPreprocessPipeline ? <PreprocessQueueStatusPanel /> : null}

        <CreateWorkspaceDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onCreate={handleCreateWorkspace}
          isCreating={isCreating}
        />

        <EditWorkspaceDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          workspaceName={editWorkspaceMeta?.name ?? ""}
          initialTag={editWorkspaceMeta?.tag}
          initialDescription={editWorkspaceMeta?.description}
          onSave={handleSaveWorkspaceEdit}
          isSaving={isSavingEdit}
        />

        <div
          ref={gridRef}
          className={directoryPageScrollClass}
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
            <div className={directoryPageGridClass}>
              {Array.from({ length: skeletonCount }).map((_, i) => (
                <WorkspaceCardSkeleton key={i} />
              ))}
            </div>
          ) : hasNoWorkspacesEver ? (
            <div className="flex flex-1 items-center justify-center py-6 text-center">
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
            <div className="flex flex-1 items-center justify-center py-6 text-muted-foreground text-sm">
              <p>No workspaces match your current filters.</p>
            </div>
          ) : (
            <div
              className={`${directoryPageGridClass} transition-opacity duration-150 ${
                isPaging ? "opacity-90" : ""
              }`}
            >
              {displayedWorkspaces.map((workspace) => {
                const key = workspaceResourceKey(workspace.name, workspace.owner_id);
                const showOwner = duplicateWorkspaceNames.has(workspace.name);
                const isCurrent =
                  currentWorkspace === workspace.name &&
                  (currentWorkspaceOwnerId == null ||
                    workspace.owner_id === currentWorkspaceOwnerId);
                return (
                  <WorkspaceCard
                    key={key}
                    workspaceName={workspace.name}
                    workspaceOwnerId={workspace.owner_id}
                    ownerUsername={workspace.owner_username}
                    showOwnerLabel={showOwner}
                    tag={workspace.tag}
                    description={workspace.description}
                    isCurrent={isCurrent}
                    onSelect={() => handleSelectWorkspace(workspace)}
                    onDelete={() => handleDeleteClick(workspace)}
                    isDeleting={isDeleting}
                    isDeletingThis={
                      workspacesToDelete.length === 1 &&
                      workspaceResourceKey(
                        workspacesToDelete[0].name,
                        workspacesToDelete[0].owner_id
                      ) === key
                    }
                    deletingWorkspaceName={
                      workspacesToDelete.length === 1
                        ? workspacesToDelete[0].name
                        : null
                    }
                    isSelected={selectedWorkspaces.has(key)}
                    onSelectionChange={(checked) =>
                      toggleWorkspaceSelection(key, checked)
                    }
                    showSelection={displayedWorkspaces.length > 0}
                    counts={workspace.counts}
                    onExtract={
                      showPreprocessPipeline
                        ? () => void handleExtract(workspace)
                        : undefined
                    }
                    isExtracting={
                      showPreprocessPipeline
                        ? isExtractingMap.get(key) || false
                        : false
                    }
                    groups={groupsForCard(workspace)}
                    onGroupsChanged={refreshAfterMutation}
                    onEdit={() => handleEditClick(workspace)}
                  />
                );
              })}
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
              ? `This action will permanently delete the workspace "${deleteDialogLabels[0]}" and all associated documents and data. This action cannot be undone.`
              : `This action will permanently delete ${workspacesToDelete.length} workspaces and all associated documents and data. This action cannot be undone.`
          }
          itemName={
            workspacesToDelete.length === 1 ? deleteDialogLabels[0] : undefined
          }
          itemNames={
            workspacesToDelete.length > 1 ? deleteDialogLabels : undefined
          }
        />
      )}
    </div>
  );
};

export default WorkspaceManagement;
