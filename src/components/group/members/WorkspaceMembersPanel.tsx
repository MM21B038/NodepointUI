"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getGroupMembers,
  removeWorkspaceFromGroup,
  type GroupWorkspaceMember,
  type WorkspacePagePagination,
} from "@/database/workspaceStorage";
import GroupAddOptionsPicker from "@/components/group/members/GroupAddOptionsPicker";
import { PaginatedMemberList } from "@/components/group/members/PaginatedMemberList";
import { MembersPanelLayout } from "@/components/group/members/MembersPanelLayout";
import {
  duplicateNamesInList,
  formatScopedResourceLabel,
  ownerParamsFrom,
  workspaceResourceKey,
} from "@/lib/ownerScope";
import type { OwnerParams } from "@/lib/ownerScope";

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
  groupOwner?: OwnerParams;
  onChanged?: () => void;
}

export function WorkspaceMembersPanel({
  groupName,
  groupOwner,
  onChanged,
}: WorkspaceMembersPanelProps) {
  const [page, setPage] = useState(1);
  const [members, setMembers] = useState<GroupWorkspaceMember[]>([]);
  const [pagination, setPagination] = useState<WorkspacePagePagination>(EMPTY_PAGINATION);
  const [loading, setLoading] = useState(true);
  const [pendingWorkspace, setPendingWorkspace] = useState<string | null>(null);

  const duplicateWorkspaceNames = useMemo(
    () => duplicateNamesInList(members),
    [members]
  );

  const loadMembers = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const pageData = await getGroupMembers(groupName, {
        page,
        page_size: 20,
        expectedTag: "workspace",
        owner: groupOwner,
      });
      const workspaceMembers = pageData.members as GroupWorkspaceMember[];
      setMembers(workspaceMembers);
      setPagination(pageData.pagination);
    } catch (error) {
      console.error(error);
      toast.error(`Failed to load members for "${groupName}".`);
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [groupName, groupOwner, page]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const removeMember = async (member: GroupWorkspaceMember) => {
    const memberKey = workspaceResourceKey(member.name, member.owner_id);
    const label = formatScopedResourceLabel(
      member.name,
      member.owner_username,
      { duplicateNames: duplicateWorkspaceNames }
    );
    setPendingWorkspace(memberKey);
    try {
      await removeWorkspaceFromGroup(groupName, member.name, {
        groupOwner,
        workspaceOwner: ownerParamsFrom(member),
      });
      toast.success(`Removed "${label}".`);
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
          {members.map((member) => {
            const memberKey = workspaceResourceKey(member.name, member.owner_id);
            const label = formatScopedResourceLabel(
              member.name,
              member.owner_username,
              { duplicateNames: duplicateWorkspaceNames }
            );
            return (
              <div
                key={memberKey}
                className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2"
              >
                <span className="truncate text-sm font-medium">{label}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-destructive/80 hover:text-destructive"
                  disabled={pendingWorkspace === memberKey}
                  onClick={() => void removeMember(member)}
                  aria-label={`Remove ${label}`}
                >
                  {pendingWorkspace === memberKey ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            );
          })}
        </PaginatedMemberList>
      }
      add={
        <GroupAddOptionsPicker
          groupName={groupName}
          groupOwner={groupOwner}
          tag="workspace"
          onAdded={() => {
            onChanged?.();
            void loadMembers({ silent: true });
          }}
        />
      }
    />
  );
}
