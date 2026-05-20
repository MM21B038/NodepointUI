"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FolderKanban,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  addWorkspaceToGroup,
  createWorkspaceGroup,
  deleteWorkspaceGroup,
  getGroup,
  listSelectableGroups,
  removeWorkspaceFromGroup,
  type WorkspaceGroupSummary,
} from "@/database/workspaceStorage";
import { isSelectableGroup } from "@/lib/viewScope";
import { useWorkspace } from "@/context/WorkspaceContext";
import GroupAssignmentList from "@/components/workspace/GroupAssignmentList";

interface ManageGroupsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceNames: string[];
  onChanged?: () => void;
  /** When opened from a card, pre-select this group if it exists. */
  initialGroupName?: string | null;
}

export default function ManageGroupsDialog({
  open,
  onOpenChange,
  workspaceNames,
  onChanged,
  initialGroupName = null,
}: ManageGroupsDialogProps) {
  const { refreshGroups } = useWorkspace();
  const [groups, setGroups] = useState<WorkspaceGroupSummary[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [members, setMembers] = useState<Set<string>>(new Set());
  const [membersLoading, setMembersLoading] = useState(false);
  const [pendingWorkspace, setPendingWorkspace] = useState<string | null>(null);

  const refreshGroupsLocal = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const list = await listSelectableGroups();
      setGroups(list);
      return list;
    } catch (error) {
      console.error("Failed to list groups:", error);
      toast.error("Failed to load groups.");
      return [];
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  const loadMembers = useCallback(async (groupName: string) => {
    setMembersLoading(true);
    try {
      const detail = await getGroup(groupName);
      setMembers(new Set(detail.workspaces.map((w) => w.name)));
    } catch (error) {
      console.error(`Failed to load group ${groupName}:`, error);
      toast.error(`Failed to load "${groupName}".`);
      setMembers(new Set());
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setGroupSearch("");
      setNewGroupName("");
      setSelectedGroup(null);
      setMembers(new Set());
      return;
    }
    void refreshGroupsLocal().then((list) => {
      const pick =
        initialGroupName && list.some((g) => g.name === initialGroupName)
          ? initialGroupName
          : list[0]?.name ?? null;
      setSelectedGroup(pick);
      if (pick) void loadMembers(pick);
    });
  }, [open, initialGroupName, refreshGroupsLocal, loadMembers]);

  useEffect(() => {
    if (!open || !selectedGroup) return;
    void loadMembers(selectedGroup);
  }, [selectedGroup, open, loadMembers]);

  const filteredGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, groupSearch]);

  const workspaceItems = useMemo(
    () =>
      workspaceNames.map((name) => ({
        id: name,
        label: name,
      })),
    [workspaceNames]
  );

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) {
      toast.error("Group name cannot be empty.");
      return;
    }
    if (!isSelectableGroup(name)) {
      toast.error("That group name is not allowed.");
      return;
    }
    setCreating(true);
    try {
      await createWorkspaceGroup(name);
      toast.success(`Group "${name}" created.`);
      setNewGroupName("");
      const list = await refreshGroupsLocal();
      await refreshGroups();
      setSelectedGroup(name);
      setMembers(new Set());
      onChanged?.();
      if (!list.some((g) => g.name === name)) {
        setGroups((prev) => [
          ...prev,
          { name, workspace_count: 0, created_at: new Date().toISOString() },
        ]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create group.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteGroup = async (groupName: string) => {
    if (
      !window.confirm(
        `Delete group "${groupName}"? Workspaces are not deleted, only removed from this group.`
      )
    ) {
      return;
    }
    try {
      await deleteWorkspaceGroup(groupName);
      toast.success(`Group "${groupName}" deleted.`);
      const list = await refreshGroupsLocal();
      await refreshGroups();
      const next = list[0]?.name ?? null;
      setSelectedGroup(next);
      if (next) void loadMembers(next);
      else setMembers(new Set());
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete group.");
    }
  };

  const handleMemberToggle = async (workspaceName: string, checked: boolean) => {
    if (!selectedGroup) return;
    setPendingWorkspace(workspaceName);
    try {
      if (checked) {
        await addWorkspaceToGroup(selectedGroup, workspaceName);
        setMembers((prev) => new Set(prev).add(workspaceName));
        toast.success(`Added "${workspaceName}" to "${selectedGroup}".`);
      } else {
        await removeWorkspaceFromGroup(selectedGroup, workspaceName);
        setMembers((prev) => {
          const next = new Set(prev);
          next.delete(workspaceName);
          return next;
        });
        toast.success(`Removed "${workspaceName}" from "${selectedGroup}".`);
      }
      await refreshGroupsLocal();
      await refreshGroups();
      onChanged?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update membership."
      );
    } finally {
      setPendingWorkspace(null);
    }
  };

  const selectedMeta = groups.find((g) => g.name === selectedGroup);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(85vh,720px)] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
          <DialogTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-muted-foreground" />
            Manage workspace groups
          </DialogTitle>
          <DialogDescription>
            Groups combine workspaces for shared chat and knowledge graph scope.
            Select a group to add or remove workspaces.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <aside className="flex w-full shrink-0 flex-col border-b sm:w-56 sm:border-b-0 sm:border-r">
            <div className="space-y-2 p-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={groupSearch}
                  onChange={(e) => setGroupSearch(e.target.value)}
                  placeholder="Search groups…"
                  className="h-8 pl-8 text-sm"
                />
              </div>
              <div className="flex gap-1">
                <Input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="New group"
                  className="h-8 flex-1 text-sm"
                  disabled={creating}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleCreateGroup();
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => void handleCreateGroup()}
                  disabled={creating || !newGroupName.trim()}
                  aria-label="Create group"
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <ScrollArea className="min-h-0 flex-1 sm:max-h-[min(52vh,420px)]">
              {loadingGroups ? (
                <p className="flex items-center gap-2 px-3 py-8 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </p>
              ) : filteredGroups.length === 0 ? (
                <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                  {groups.length === 0
                    ? "Create a group above."
                    : "No groups match search."}
                </p>
              ) : (
                <ul className="p-1.5 space-y-0.5">
                  {filteredGroups.map((g) => (
                    <li key={g.name}>
                      <button
                        type="button"
                        onClick={() => setSelectedGroup(g.name)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                          selectedGroup === g.name
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-muted/60"
                        )}
                      >
                        <span className="truncate">{g.name}</span>
                        <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
                          {g.workspace_count}
                        </Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col p-4 sm:p-5">
            {!selectedGroup ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center text-sm text-muted-foreground">
                <FolderKanban className="mb-3 h-10 w-10 opacity-30" />
                <p>Select or create a group to manage its workspaces.</p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold">{selectedGroup}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {membersLoading
                        ? "Loading members…"
                        : `${members.size} workspace${members.size === 1 ? "" : "s"} in this group`}
                      {selectedMeta != null &&
                        ` · ${selectedMeta.workspace_count} on server`}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-destructive hover:text-destructive"
                    onClick={() => void handleDeleteGroup(selectedGroup)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>

                <div className="flex min-h-0 flex-1 flex-col space-y-2">
                  <Label>Workspaces in this group</Label>
                  {workspaceNames.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">
                      No workspaces exist yet. Create a workspace first.
                    </p>
                  ) : membersLoading ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <GroupAssignmentList
                      items={workspaceItems}
                      selectedIds={members}
                      onToggle={(id, checked) => void handleMemberToggle(id, checked)}
                      pendingId={pendingWorkspace}
                      searchPlaceholder="Search workspaces…"
                      emptyMessage="No workspaces available."
                      heightClass="h-[min(40vh,320px)]"
                      showSearchThreshold={1}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
