"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addFileToGroup,
  getAllGroupMembers,
  getAllWorkspaces,
  getGroupMembers,
  listDocuments,
  removeFileFromGroup,
  type GroupFileMember,
  type WorkspacePagePagination,
} from "@/database/workspaceStorage";
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

interface FilesMembersPanelProps {
  groupName: string;
  onChanged?: () => void;
}

export function FilesMembersPanel({ groupName, onChanged }: FilesMembersPanelProps) {
  const [page, setPage] = useState(1);
  const [members, setMembers] = useState<GroupFileMember[]>([]);
  const [pagination, setPagination] = useState<WorkspacePagePagination>(EMPTY_PAGINATION);
  const [memberIdSet, setMemberIdSet] = useState<Set<string>>(new Set());
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("");
  const [documents, setDocuments] = useState<{ id: string; file_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const loadMembers = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const [pageData, allMembers] = await Promise.all([
        getGroupMembers(groupName, { page, page_size: 20, expectedTag: "files" }),
        getAllGroupMembers(groupName, { expectedTag: "files" }),
      ]);
      const pageMembers = pageData.members as GroupFileMember[];
      const allMembersTyped = allMembers as GroupFileMember[];
      setMembers(pageMembers);
      setPagination(pageData.pagination);
      setMemberIdSet(new Set(allMembersTyped.map((m) => m.document_id).filter(Boolean)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load files.");
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [groupName, page]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    void getAllWorkspaces().then((list) => {
      const names = list.map((w) => w.name).sort((a, b) => a.localeCompare(b));
      setWorkspaces(names);
      if (names.length > 0 && !selectedWorkspace) setSelectedWorkspace(names[0]);
    });
  }, [selectedWorkspace]);

  useEffect(() => {
    if (!selectedWorkspace) {
      setDocuments([]);
      return;
    }
    setLoadingDocs(true);
    void listDocuments(selectedWorkspace)
      .then((res) => {
        setDocuments(
          res.files.map((f) => ({ id: f.id, file_name: f.file_name }))
        );
      })
      .catch(() => setDocuments([]))
      .finally(() => setLoadingDocs(false));
  }, [selectedWorkspace]);

  const addFile = async (documentId: string) => {
    setPendingId(documentId);
    try {
      await addFileToGroup(groupName, documentId);
      toast.success("File added to group.");
      setMemberIdSet((prev) => new Set(prev).add(documentId));
      onChanged?.();
      await loadMembers({ silent: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add file.");
    } finally {
      setPendingId(null);
    }
  };

  const removeFile = async (documentId: string) => {
    setPendingId(documentId);
    try {
      await removeFileFromGroup(groupName, documentId);
      toast.success("File removed.");
      setMemberIdSet((prev) => {
        const next = new Set(prev);
        next.delete(documentId);
        return next;
      });
      onChanged?.();
      await loadMembers({ silent: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove file.");
    } finally {
      setPendingId(null);
    }
  };

  const memberIds = memberIdSet;

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
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{member.file_name}</p>
                <p className="truncate text-xs text-muted-foreground">{member.workspace}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive/80"
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
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {groupMemberAddTitle("files")}
          </p>
          <div className="space-y-2">
            <Label htmlFor="files-workspace">Workspace</Label>
            <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace}>
              <SelectTrigger id="files-workspace">
                <SelectValue placeholder="Select workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((ws) => (
                  <SelectItem key={ws} value={ws}>
                    {ws}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {loadingDocs ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <div className="max-h-[min(10rem,22vh)] space-y-1 overflow-y-auto overscroll-contain">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-2 rounded border border-border/40 px-2 py-1.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-xs">{doc.file_name}</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 shrink-0 text-xs"
                    disabled={memberIds.has(doc.id) || pendingId === doc.id}
                    onClick={() => void addFile(doc.id)}
                  >
                    {memberIds.has(doc.id) ? "Added" : "Add"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      }
    />
  );
}
