"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useWorkspace } from "@/context/WorkspaceContext";
import {
  createWorkspaceGroup,
  deleteWorkspaceGroups,
  updateGroup,
  type GroupTag,
  type WorkspaceGroupSummary,
} from "@/database/workspaceStorage";
import { toast } from "sonner";
import DeleteConfirmationDialog from "@/components/DeleteConfirmationDialog";
import GroupCard from "@/components/group/GroupCard";
import GroupCardSkeleton from "@/components/group/GroupCardSkeleton";
import GroupManagementToolbar from "@/components/group/GroupManagementToolbar";
import CreateGroupDialog, {
  type CreateGroupFormValues,
} from "@/components/group/CreateGroupDialog";
import EditGroupDialog, {
  type EditGroupFormValues,
} from "@/components/group/EditGroupDialog";
import GroupMembersDialog from "@/components/group/GroupMembersDialog";
import {
  directoryPageGridClass,
  directoryPagePanelClass,
  directoryPageScrollClass,
} from "@/components/directory/directoryPageStyles";
import { useWorkspaceGridPageSize } from "@/hooks/useWorkspaceGridPageSize";
import { useGroupDirectory } from "@/hooks/useGroupDirectory";
import { isSelectableGroup } from "@/lib/viewScope";
import {
  duplicateNamesInList,
  groupResourceKey,
  listHasMultipleOwners,
  ownerParamsFrom,
} from "@/lib/ownerScope";

const GroupManagement = () => {
  const { activeGroup, activeGroupOwnerId, setActiveGroup, refreshGroups } = useWorkspace();
  const { gridRef, pageSize } = useWorkspaceGridPageSize();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editGroupName, setEditGroupName] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [membersGroupName, setMembersGroupName] = useState<string | null>(null);
  const [membersGroupOwner, setMembersGroupOwner] = useState<
    ReturnType<typeof ownerParamsFrom>
  >(undefined);
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<GroupTag | "all">("all");
  const [page, setPage] = useState(1);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [groupsToDelete, setGroupsToDelete] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasGroupsEver, setHasGroupsEver] = useState<boolean | null>(null);

  const prevPageSizeRef = useRef(pageSize);

  const {
    groups: displayedGroups,
    pagination: activePagination,
    isInitialLoading,
    isPaging,
    isSearchActive,
    invalidateCache,
    reload,
  } = useGroupDirectory({
    page,
    pageSize,
    searchQuery: debouncedSearch,
    tagFilter,
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, tagFilter]);

  useEffect(() => {
    if (prevPageSizeRef.current !== pageSize) {
      prevPageSizeRef.current = pageSize;
      setPage(1);
    }
  }, [pageSize]);

  useEffect(() => {
    if (activePagination.total_pages > 0 && page > activePagination.total_pages) {
      setPage(activePagination.total_pages);
    }
  }, [activePagination.total_pages, page]);

  useEffect(() => {
    if (!isInitialLoading && hasGroupsEver === null) {
      setHasGroupsEver(activePagination.total_items > 0 || debouncedSearch.length > 0);
    }
  }, [isInitialLoading, activePagination.total_items, debouncedSearch, hasGroupsEver]);

  const displayedGroupNames = useMemo(
    () => displayedGroups.map((group) => group.name),
    [displayedGroups]
  );

  const duplicateGroupNames = useMemo(
    () => duplicateNamesInList(displayedGroups),
    [displayedGroups]
  );

  const multiOwnerGroups = useMemo(
    () => listHasMultipleOwners(displayedGroups),
    [displayedGroups]
  );

  useEffect(() => {
    setSelectedGroups((prev) => {
      const next = new Set<string>();
      for (const name of prev) {
        if (displayedGroupNames.includes(name)) next.add(name);
      }
      return next;
    });
  }, [displayedGroupNames.join("\0")]);

  const allDisplayedSelected =
    displayedGroupNames.length > 0 &&
    displayedGroupNames.every((name) => selectedGroups.has(name));
  const someSelected = selectedGroups.size > 0;

  const toggleGroupSelection = (groupName: string, checked: boolean) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (checked) next.add(groupName);
      else next.delete(groupName);
      return next;
    });
  };

  const toggleSelectAllDisplayed = (checked: boolean) => {
    setSelectedGroups(checked ? new Set(displayedGroupNames) : new Set());
  };

  const clearSelection = () => setSelectedGroups(new Set());

  const refreshAfterMutation = useCallback(async () => {
    await refreshGroups();
    invalidateCache();
    reload();
  }, [refreshGroups, invalidateCache, reload]);

  const handleCreateGroup = async (values: CreateGroupFormValues) => {
    if (!isSelectableGroup(values.name)) {
      toast.error("That group name is not allowed.");
      return;
    }

    setIsCreating(true);
    const loadingToastId = toast.loading(`Creating group "${values.name}"...`);

    try {
      await createWorkspaceGroup(values.name, {
        tag: values.tag,
        description: values.description,
      });
      toast.success(`Group "${values.name}" created successfully!`, {
        id: loadingToastId,
      });
      setCreateDialogOpen(false);
      setPage(1);
      setHasGroupsEver(true);
      await refreshAfterMutation();
      setActiveGroup(values.name);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create group.",
        { id: loadingToastId }
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectGroup = (group: WorkspaceGroupSummary) => {
    setActiveGroup(group.name, group.owner_id ?? null);
    toast.success(`Active group: ${group.name}`);
  };

  const handleManageMembers = (group: WorkspaceGroupSummary) => {
    setMembersGroupName(group.name);
    setMembersGroupOwner(ownerParamsFrom(group));
    setMembersDialogOpen(true);
  };

  const editGroupMeta = useMemo(
    () => displayedGroups.find((g) => g.name === editGroupName) ?? null,
    [displayedGroups, editGroupName]
  );

  const handleEditClick = (groupName: string) => {
    setEditGroupName(groupName);
    setEditDialogOpen(true);
  };

  const handleSaveGroupEdit = async (values: EditGroupFormValues) => {
    if (!editGroupName) return;
    setIsSavingEdit(true);
    try {
      const patch: Parameters<typeof updateGroup>[1] = {};
      if (values.name !== editGroupName) patch.name = values.name;
      if (values.clearDescription) patch.description = null;
      else if ((values.description ?? null) !== (editGroupMeta?.description ?? null)) {
        patch.description = values.description;
      }
      if (Object.keys(patch).length === 0) {
        setEditDialogOpen(false);
        return;
      }

      const result = await updateGroup(editGroupName, patch);
      const newName = result.group.name;
      if (activeGroup === editGroupName && newName !== editGroupName) {
        setActiveGroup(newName);
      }
      toast.success(`Group "${newName}" updated.`);
      setEditDialogOpen(false);
      setEditGroupName(null);
      await refreshAfterMutation();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update group.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteClick = (groupName: string) => {
    setGroupsToDelete([groupName]);
    setIsDeleteDialogOpen(true);
  };

  const handleBulkDeleteClick = () => {
    if (selectedGroups.size === 0) return;
    setGroupsToDelete(Array.from(selectedGroups));
    setIsDeleteDialogOpen(true);
  };

  const executeDeleteGroups = useCallback(async () => {
    if (groupsToDelete.length === 0) return;

    setIsDeleting(true);
    const loadingToastId = toast.loading(
      groupsToDelete.length === 1
        ? `Deleting group ${groupsToDelete[0]}...`
        : `Deleting ${groupsToDelete.length} groups...`
    );

    try {
      const result = await deleteWorkspaceGroups(groupsToDelete);
      if (result.failed.length === 0) {
        toast.success(
          groupsToDelete.length === 1
            ? `Group "${groupsToDelete[0]}" deleted successfully!`
            : `${result.succeeded.length} groups deleted successfully!`,
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

      if (result.succeeded.includes(activeGroup ?? "")) {
        setActiveGroup(null);
      }
      if (result.succeeded.length > 0) {
        clearSelection();
        await refreshAfterMutation();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unknown error during deletion.",
        { id: loadingToastId }
      );
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setGroupsToDelete([]);
    }
  }, [groupsToDelete, activeGroup, setActiveGroup, refreshAfterMutation]);

  const handlePreviousPage = () => {
    setPage((p) => Math.max(1, p - 1));
  };

  const handleNextPage = () => {
    setPage((p) => Math.min(activePagination.total_pages, p + 1));
  };

  const skeletonCount = Math.max(4, pageSize);
  const isInitialGridLoad = isInitialLoading && displayedGroups.length === 0;
  const hasNoGroupsEver = hasGroupsEver === false && !isSearchActive;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col w-full">
      <div className={directoryPagePanelClass}>
        <GroupManagementToolbar
          onOpenCreateGroup={() => setCreateDialogOpen(true)}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          tagFilter={tagFilter}
          onTagFilterChange={setTagFilter}
          totalItems={activePagination.total_items}
          page={activePagination.page}
          totalPages={Math.max(1, activePagination.total_pages || 1)}
          hasPrevious={activePagination.has_previous}
          hasNext={activePagination.has_next}
          onPreviousPage={handlePreviousPage}
          onNextPage={handleNextPage}
          isSearchActive={isSearchActive}
          selectedCount={selectedGroups.size}
          allDisplayedSelected={allDisplayedSelected}
          someSelected={someSelected}
          onToggleSelectAllDisplayed={toggleSelectAllDisplayed}
          onBulkDelete={handleBulkDeleteClick}
          onClearSelection={clearSelection}
          isDeleting={isDeleting}
        />

        <CreateGroupDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onCreate={handleCreateGroup}
          isCreating={isCreating}
        />

        <EditGroupDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          groupName={editGroupName ?? ""}
          groupTag={editGroupMeta?.tag ?? "workspace"}
          initialDescription={editGroupMeta?.description}
          onSave={handleSaveGroupEdit}
          isSaving={isSavingEdit}
        />

        <GroupMembersDialog
          open={membersDialogOpen}
          onOpenChange={setMembersDialogOpen}
          groupName={membersGroupName}
          groupOwner={membersGroupOwner}
          onChanged={() => void refreshAfterMutation()}
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
                <GroupCardSkeleton key={i} />
              ))}
            </div>
          ) : hasNoGroupsEver ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[12rem] text-center">
              <Alert className="max-w-lg">
                <Info className="h-4 w-4" />
                <AlertTitle>No Groups Found</AlertTitle>
                <AlertDescription>
                  You do not have any groups yet. Click New group to create one
                  and combine workspaces for shared chat and knowledge graph scope.
                </AlertDescription>
              </Alert>
            </div>
          ) : activePagination.total_items === 0 ? (
            <div className="flex items-center justify-center h-full min-h-[12rem] text-muted-foreground text-lg">
              <p>No groups match your search.</p>
            </div>
          ) : (
            <div
              className={`${directoryPageGridClass} transition-opacity duration-150 ${
                isPaging ? "opacity-90" : ""
              }`}
            >
              {displayedGroups.map((group: WorkspaceGroupSummary) => (
                <GroupCard
                  key={groupResourceKey(group.name, group.owner_id)}
                  groupName={group.name}
                  ownerUsername={group.owner_username}
                  showOwnerLabel={
                    duplicateGroupNames.has(group.name) || multiOwnerGroups
                  }
                  groupTag={group.tag}
                  description={group.description}
                  memberCount={group.member_count}
                  isActive={
                    activeGroup === group.name &&
                    (activeGroupOwnerId == null ||
                      group.owner_id === activeGroupOwnerId)
                  }
                  onSelect={() => handleSelectGroup(group)}
                  onManageMembers={() => handleManageMembers(group)}
                  onEdit={() => handleEditClick(group.name)}
                  onDelete={() => handleDeleteClick(group.name)}
                  isDeleting={isDeleting}
                  deletingGroupName={
                    groupsToDelete.length === 1 ? groupsToDelete[0] : null
                  }
                  isSelected={selectedGroups.has(group.name)}
                  onSelectionChange={(checked) =>
                    toggleGroupSelection(group.name, checked)
                  }
                  showSelection={displayedGroups.length > 0}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {groupsToDelete.length > 0 && (
        <DeleteConfirmationDialog
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          onConfirm={executeDeleteGroups}
          title={
            groupsToDelete.length === 1
              ? "Permanently Delete Group"
              : `Permanently Delete ${groupsToDelete.length} Groups`
          }
          description={
            groupsToDelete.length === 1
              ? `This action will permanently delete the group "${groupsToDelete[0]}". Workspaces are not deleted, only removed from this group. This action cannot be undone.`
              : `This action will permanently delete ${groupsToDelete.length} groups. Workspaces are not deleted. This action cannot be undone.`
          }
          itemName={groupsToDelete.length === 1 ? groupsToDelete[0] : undefined}
          itemNames={groupsToDelete.length > 1 ? groupsToDelete : undefined}
        />
      )}
    </div>
  );
};

export default GroupManagement;
