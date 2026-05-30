"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addRelationToGroup,
  getAllWorkspaces,
  getGroupMembers,
  removeRelationFromGroup,
  type GroupRelationMember,
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

interface RelationsMembersPanelProps {
  groupName: string;
  onChanged?: () => void;
}

export function RelationsMembersPanel({
  groupName,
  onChanged,
}: RelationsMembersPanelProps) {
  const [page, setPage] = useState(1);
  const [members, setMembers] = useState<GroupRelationMember[]>([]);
  const [pagination, setPagination] = useState<WorkspacePagePagination>(EMPTY_PAGINATION);
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("");
  const [relationId, setRelationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const loadMembers = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const pageData = await getGroupMembers(groupName, {
        page,
        page_size: 20,
        expectedTag: "relation",
      });
      setMembers(pageData.members as GroupRelationMember[]);
      setPagination(pageData.pagination);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load relations.");
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

  const addRelation = async () => {
    const trimmed = relationId.trim();
    if (!trimmed) return;
    setPendingId(trimmed);
    try {
      await addRelationToGroup(groupName, trimmed);
      toast.success("Relation added to group.");
      setRelationId("");
      onChanged?.();
      await loadMembers({ silent: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add relation.");
    } finally {
      setPendingId(null);
    }
  };

  const removeRelation = async (id: string) => {
    setPendingId(id);
    try {
      await removeRelationFromGroup(groupName, id);
      toast.success("Relation removed.");
      onChanged?.();
      await loadMembers({ silent: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove relation.");
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
          tag="relation"
          pagination={pagination}
          onPrevious={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => p + 1)}
          isEmpty={pagination.total_items === 0}
        >
          {members.map((member) => (
            <div
              key={member.relation_id}
              className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {member.source} → {member.target}
                </p>
                <p className="truncate text-xs text-muted-foreground">{member.workspace}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive/80"
                disabled={pendingId === member.relation_id}
                onClick={() => void removeRelation(member.relation_id)}
              >
                {pendingId === member.relation_id ? (
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
            {groupMemberAddTitle("relation")}
          </p>
          <div className="space-y-1">
            <Label htmlFor="relation-workspace">Context workspace</Label>
            <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace}>
              <SelectTrigger id="relation-workspace">
                <SelectValue placeholder="Workspace" />
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
          <div className="flex gap-1">
            <Input
              value={relationId}
              onChange={(e) => setRelationId(e.target.value)}
              placeholder="Relation UUID"
              onKeyDown={(e) => e.key === "Enter" && void addRelation()}
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              disabled={!relationId.trim() || pendingId !== null}
              onClick={() => void addRelation()}
            >
              {pendingId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Use a relation UUID from the knowledge graph ({selectedWorkspace || "workspace"}).
          </p>
        </div>
      }
    />
  );
}
