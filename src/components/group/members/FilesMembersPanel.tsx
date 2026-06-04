"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getGroupMembers,
  removeFileFromGroup,
  type GroupFileMember,
  type WorkspacePagePagination,
} from "@/database/workspaceStorage";
import GroupAddOptionsPicker from "@/components/group/members/GroupAddOptionsPicker";
import { PaginatedMemberList } from "@/components/group/members/PaginatedMemberList";
import { MembersPanelLayout } from "@/components/group/members/MembersPanelLayout";
import type { OwnerParams } from "@/lib/ownerScope";

const EMPTY_PAGINATION: WorkspacePagePagination = {
  page: 1,
  page_size: 20,
  total_items: 0,
  total_pages: 0,
  has_next: false,
  has_previous: false,
};

interface FilesMembersPanelProps {
  groupName: string;
  groupOwner?: OwnerParams;
  onChanged?: () => void;
}

export function FilesMembersPanel({
  groupName,
  groupOwner,
  onChanged,
}: FilesMembersPanelProps) {
  const [page, setPage] = useState(1);
  const [members, setMembers] = useState<GroupFileMember[]>([]);
  const [pagination, setPagination] = useState<WorkspacePagePagination>(EMPTY_PAGINATION);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const loadMembers = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const pageData = await getGroupMembers(groupName, {
        page,
        page_size: 20,
        expectedTag: "files",
        owner: groupOwner,
      });
      setMembers(pageData.members as GroupFileMember[]);
      setPagination(pageData.pagination);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load files.");
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [groupName, groupOwner, page]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const removeFile = async (documentId: string) => {
    setPendingId(documentId);
    try {
      await removeFileFromGroup(groupName, documentId, { groupOwner });
      toast.success("File removed.");
      onChanged?.();
      await loadMembers({ silent: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove file.");
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
          tag="files"
          pagination={pagination}
          onPrevious={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => p + 1)}
          isEmpty={pagination.total_items === 0}
        >
          {members.map((member) => (
            <div
              key={member.document_id}
              className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2"
            >
              <div className="min-w-0 flex items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{member.file_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {member.workspace}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive/80 hover:text-destructive"
                disabled={pendingId === member.document_id}
                onClick={() => void removeFile(member.document_id)}
              >
                {pendingId === member.document_id ? (
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
          tag="files"
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
