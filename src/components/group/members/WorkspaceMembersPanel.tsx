"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  addWorkspaceToGroup,
  getAllGroupMembers,
  getAllWorkspaces,
  getGroupMembers,
  removeWorkspaceFromGroup,
  type GroupWorkspaceMember,
  type WorkspacePagePagination,
} from "@/database/workspaceStorage";
import GroupAssignmentList from "@/components/workspace/GroupAssignmentList";
import { PaginatedMemberList } from "@/components/group/members/PaginatedMemberList";
import { MembersPanelLayout } from "@/components/group/members/MembersPanelLayout";
import { groupMemberAddTitle } from "@/lib/groupTag";

const EMPTY_PAGINATION: WorkspacePagePagination = {
  page: 1,
  page_size: 20,
  total_items: 0,
  total_pages: 0,
  has_next: false,
  has_previous: false,
};

interface WorkspaceMembersPanelProps {
  groupName: string;
  onChanged?: () => void;
}

export function WorkspaceMembersPanel({
  groupName,
  onChanged,
}: WorkspaceMembersPanelProps) {
  const [page, setPage] = useState(1);
  const [members, setMembers] = useState<GroupWorkspaceMember[]>([]);
  const [pagination, setPagination] = useState<WorkspacePagePagination>(EMPTY_PAGINATION);
  const [workspaceNames, setWorkspaceNames] = useState<string[]>([]);
  const [memberSet, setMemberSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [pendingWorkspace, setPendingWorkspace] = useState<string | null>(null);

  const loadMembers = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const [pageData, allMembers, workspaces] = await Promise.all([
        getGroupMembers(groupName, { page, page_size: 20, expectedTag: "workspace" }),
        getAllGroupMembers(groupName, { expectedTag: "workspace" }),
        getAllWorkspaces(),
      ]);
      const workspaceMembers = pageData.members as GroupWorkspaceMember[];
      const allMemberNames = allMembers as GroupWorkspaceMember[];
      setMembers(workspaceMembers);
      setPagination(pageData.pagination);
      setMemberSet(new Set(allMemberNames.map((m) => m.name).filter(Boolean)));
      setWorkspaceNames(workspaces.map((w) => w.name).sort((a, b) => a.localeCompare(b)));
    } catch (error) {
      console.error(error);
      toast.error(`Failed to load members for "${groupName}".`);
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [groupName, page]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const workspaceItems = useMemo(
    () =>
      workspaceNames.map((name) => ({
        id: name,
        label: name,
      })),
    [workspaceNames]
  );

  const toggleMembership = async (workspaceName: string, checked: boolean) => {
    setPendingWorkspace(workspaceName);
    try {
      if (checked) {
        await addWorkspaceToGroup(groupName, workspaceName);
        toast.success(`Added "${workspaceName}".`);
      } else {
        await removeWorkspaceFromGroup(groupName, workspaceName);
        toast.success(`Removed "${workspaceName}".`);
      }
      onChanged?.();
      await loadMembers({ silent: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setPendingWorkspace(null);
    }
  };

  if (loading && members.length === 0) {
    return (
      <div className="flex flex-1 justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <MembersPanelLayout
      list={
        <PaginatedMemberList
          tag="workspace"
          pagination={pagination}
          onPrevious={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => p + 1)}
          isEmpty={pagination.total_items === 0}
        >
          {members.map((member) => (
            <div
              key={member.name}
              className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2"
            >
              <span className="truncate text-sm font-medium">{member.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive/80 hover:text-destructive"
                disabled={pendingWorkspace === member.name}
                onClick={() => void toggleMembership(member.name, false)}
                aria-label={`Remove ${member.name}`}
              >
                {pendingWorkspace === member.name ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          ))}
        </PaginatedMemberList>
      }
      add={
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {groupMemberAddTitle("workspace")}
          </p>
          <GroupAssignmentList
            items={workspaceItems}
            selectedIds={memberSet}
            onToggle={(id, checked) => void toggleMembership(id, checked)}
            pendingId={pendingWorkspace}
            heightClass="h-[min(10rem,22vh)]"
          />
        </div>
      }
    />
  );
}
