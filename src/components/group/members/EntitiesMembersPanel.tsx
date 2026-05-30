"use client";

import { useCallback, useEffect, useState } from "react";
import { GitGraph, Loader2, Plus, Search, Trash2 } from "lucide-react";
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
  addEntityToGroup,
  getAllGroupMembers,
  getAllWorkspaces,
  getGroupMembers,
  removeEntityFromGroup,
  searchKnowledgeEntities,
  type GroupEntityMember,
  type WorkspacePagePagination,
} from "@/database/workspaceStorage";
import { MembersPanelLayout } from "@/components/group/members/MembersPanelLayout";
import { PaginatedMemberList } from "@/components/group/members/PaginatedMemberList";
import { groupMemberAddTitle, groupMemberSearchHint } from "@/lib/groupTag";

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
  onChanged?: () => void;
}

export function EntitiesMembersPanel({
  groupName,
  onChanged,
}: EntitiesMembersPanelProps) {
  const [page, setPage] = useState(1);
  const [members, setMembers] = useState<GroupEntityMember[]>([]);
  const [pagination, setPagination] = useState<WorkspacePagePagination>(EMPTY_PAGINATION);
  const [memberIdSet, setMemberIdSet] = useState<Set<string>>(new Set());
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { id: string; name: string; entity_type: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const loadMembers = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) setLoading(true);
      try {
        const [pageData, allMembers] = await Promise.all([
          getGroupMembers(groupName, { page, page_size: 20, expectedTag: "entity" }),
          getAllGroupMembers(groupName, { expectedTag: "entity" }),
        ]);
        const pageMembers = pageData.members as GroupEntityMember[];
        const allMembersTyped = allMembers as GroupEntityMember[];
        setMembers(pageMembers);
        setPagination(pageData.pagination);
        setMemberIdSet(new Set(allMembersTyped.map((m) => m.entity_id).filter(Boolean)));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load entities.");
      } finally {
        if (!options?.silent) setLoading(false);
      }
    },
    [groupName, page]
  );

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

  const runSearch = async () => {
    if (!selectedWorkspace || !query.trim()) return;
    setSearching(true);
    try {
      const res = await searchKnowledgeEntities(
        { workspaceName: selectedWorkspace },
        { q: query.trim(), matchLimit: 20 }
      );
      setSearchResults(
        res.matches.map((m) => ({
          id: m.id,
          name: m.name,
          entity_type: m.entity_type,
        }))
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Search failed.");
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const addEntity = async (entityId: string) => {
    setPendingId(entityId);
    try {
      await addEntityToGroup(groupName, entityId);
      toast.success("Entity added to group.");
      setMemberIdSet((prev) => new Set(prev).add(entityId));
      onChanged?.();
      await loadMembers({ silent: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add entity.");
    } finally {
      setPendingId(null);
    }
  };

  const removeEntity = async (entityId: string) => {
    setPendingId(entityId);
    try {
      await removeEntityFromGroup(groupName, entityId);
      toast.success("Entity removed.");
      setMemberIdSet((prev) => {
        const next = new Set(prev);
        next.delete(entityId);
        return next;
      });
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
                className="h-8 w-8 shrink-0 text-destructive/80"
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
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {groupMemberAddTitle("entity")}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="entity-workspace">Workspace</Label>
              <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace}>
                <SelectTrigger id="entity-workspace">
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
            <div className="space-y-1">
              <Label htmlFor="entity-search">Search name</Label>
              <div className="flex gap-1">
                <Input
                  id="entity-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Entity name"
                  onKeyDown={(e) => e.key === "Enter" && void runSearch()}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  disabled={searching || !query.trim()}
                  onClick={() => void runSearch()}
                >
                  {searching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          <div className="max-h-[min(10rem,22vh)] space-y-1 overflow-y-auto overscroll-contain">
            {searchResults.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">
                {groupMemberSearchHint("entity")}
              </p>
            ) : (
              searchResults.map((match) => (
                <div
                  key={match.id}
                  className="flex items-center justify-between gap-2 rounded border border-border/40 px-2 py-1.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <GitGraph className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{match.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {match.entity_type}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 shrink-0 text-xs"
                    disabled={memberIdSet.has(match.id) || pendingId === match.id}
                    onClick={() => void addEntity(match.id)}
                  >
                    {memberIdSet.has(match.id) ? "Added" : "Add"}
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      }
    />
  );
}
