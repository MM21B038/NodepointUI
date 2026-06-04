"use client";

import { useCallback, useEffect, useState } from "react";
import { GitGraph, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getGroupMembers,
  removeEntityFromGroup,
  type GroupEntityMember,
  type WorkspacePagePagination,
} from "@/database/workspaceStorage";
import GroupAddOptionsPicker from "@/components/group/members/GroupAddOptionsPicker";
import { MembersPanelLayout } from "@/components/group/members/MembersPanelLayout";
import { PaginatedMemberList } from "@/components/group/members/PaginatedMemberList";
import type { OwnerParams } from "@/lib/ownerScope";

const EMPTY_PAGINATION: WorkspacePagePagination = {
  page: 1,
  page_size: 20,
  total_items: 0,
  total_pages: 0,
  has_next: false,
  has_previous: false,
};

interface EntitiesMembersPanelProps {
  groupName: string;
  groupOwner?: OwnerParams;
  onChanged?: () => void;
}

export function EntitiesMembersPanel({
  groupName,
  groupOwner,
  onChanged,
}: EntitiesMembersPanelProps) {
  const [page, setPage] = useState(1);
  const [members, setMembers] = useState<GroupEntityMember[]>([]);
  const [pagination, setPagination] = useState<WorkspacePagePagination>(EMPTY_PAGINATION);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const loadMembers = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const pageData = await getGroupMembers(groupName, {
        page,
        page_size: 20,
        expectedTag: "entity",
        owner: groupOwner,
      });
      setMembers(pageData.members as GroupEntityMember[]);
      setPagination(pageData.pagination);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load entities.");
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [groupName, groupOwner, page]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const removeEntity = async (entityId: string) => {
    setPendingId(entityId);
    try {
      await removeEntityFromGroup(groupName, entityId, { groupOwner });
      toast.success("Entity removed.");
      onChanged?.();
      await loadMembers({ silent: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove entity.");
    } finally {
      setPendingId(null);
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
          tag="entity"
          pagination={pagination}
          onPrevious={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => p + 1)}
          isEmpty={pagination.total_items === 0}
        >
          {members.map((member) => (
            <div
              key={member.entity_id}
              className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{member.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {member.entity_type} · {member.workspace}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive/80 hover:text-destructive"
                disabled={pendingId === member.entity_id}
                onClick={() => void removeEntity(member.entity_id)}
              >
                {pendingId === member.entity_id ? (
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
        <GroupAddOptionsPicker
          groupName={groupName}
          groupOwner={groupOwner}
          tag="entity"
          showCandidateOwnerFilter
          onAdded={() => {
            onChanged?.();
            void loadMembers({ silent: true });
          }}
        />
      }
    />
  );
}
