"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
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
import { PaginatedMemberList } from "@/components/group/members/PaginatedMemberList";
import { useAuth } from "@/context/AuthContext";
import {
  addEntityToGroup,
  addFileToGroup,
  addRelationToGroup,
  addWorkspaceToGroup,
  type GroupAddOption,
  type GroupTag,
} from "@/database/workspaceStorage";
import { listUsers } from "@/database/authStorage";
import { useGroupAddOptions } from "@/hooks/useGroupAddOptions";
import { groupMemberAddTitle } from "@/lib/groupTag";
import {
  groupAddOptionHint,
  groupAddOptionId,
  groupAddOptionLabel,
  supportsCandidateOwnerFilter,
} from "@/lib/groupAddOptions";
import {
  duplicateNamesInList,
  listHasMultipleOwners,
  ownerParamsFrom,
} from "@/lib/ownerScope";
import type { OwnerParams } from "@/lib/ownerScope";

interface GroupAddOptionsPickerProps {
  groupName: string;
  groupOwner?: OwnerParams;
  tag: GroupTag;
  onAdded?: () => void;
  showCandidateOwnerFilter?: boolean;
}

export default function GroupAddOptionsPicker({
  groupName,
  groupOwner,
  tag,
  onAdded,
  showCandidateOwnerFilter = false,
}: GroupAddOptionsPickerProps) {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin", "superadmin");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [candidateOwnerId, setCandidateOwnerId] = useState<string>("");
  const [userOptions, setUserOptions] = useState<
    { id: number; username: string }[]
  >([]);

  const candidateId =
    candidateOwnerId && candidateOwnerId !== "all"
      ? Number(candidateOwnerId)
      : undefined;

  const {
    search,
    setSearch,
    page,
    setPage,
    items,
    pagination,
    loading,
    error,
    reload,
  } = useGroupAddOptions({
    groupName,
    groupOwner,
    tag,
    candidateOwnerId: candidateId,
    enabled: true,
  });

  const showOwnerFilter =
    showCandidateOwnerFilter &&
    isAdmin &&
    supportsCandidateOwnerFilter(tag);

  useEffect(() => {
    if (!showOwnerFilter) return;
    void listUsers({ page_size: 100 }).then(({ users }) => {
      setUserOptions(
        users.map((u) => ({ id: u.id, username: u.username }))
      );
    });
  }, [showOwnerFilter]);

  const duplicateWorkspaceNames = useMemo(() => {
    if (tag !== "workspace") return new Set<string>();
    const workspaces = items.filter((i) => i.kind === "workspace");
    return duplicateNamesInList(
      workspaces.map((w) => ({ name: w.name }))
    );
  }, [items, tag]);

  const multiOwnerWorkspaceOptions = useMemo(() => {
    if (tag !== "workspace") return false;
    return listHasMultipleOwners(
      items.filter((i) => i.kind === "workspace").map((w) => ({
        owner_id: w.owner_id,
      }))
    );
  }, [items, tag]);

  const handleAdd = async (option: GroupAddOption) => {
    const id = groupAddOptionId(option);
    setPendingId(id);
    const label = groupAddOptionLabel(
      option,
      duplicateWorkspaceNames,
      multiOwnerWorkspaceOptions
    );
    try {
      const mutation = { groupOwner };
      switch (option.kind) {
        case "workspace":
          await addWorkspaceToGroup(groupName, option.name, {
            ...mutation,
            workspaceOwner: ownerParamsFrom({
              name: option.name,
              owner_id: option.owner_id,
              owner_username: option.owner_username,
            }),
          });
          break;
        case "files":
          await addFileToGroup(groupName, option.document_id, mutation);
          break;
        case "entity":
          await addEntityToGroup(groupName, option.entity_id, mutation);
          break;
        case "relation":
          await addRelationToGroup(groupName, option.relation_id, mutation);
          break;
      }
      toast.success(`Added "${label}".`);
      onAdded?.();
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        {groupMemberAddTitle(tag)}
      </p>

      {showOwnerFilter ? (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Candidate owner</Label>
          <Select
            value={candidateOwnerId || "all"}
            onValueChange={setCandidateOwnerId}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All eligible owners" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All eligible owners</SelectItem>
              {userOptions.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search eligible items…"
          className="h-9 pl-8"
        />
      </div>

      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}

      {loading && items.length === 0 ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <PaginatedMemberList
          tag={tag}
          pagination={pagination}
          onPrevious={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => p + 1)}
          isEmpty={!loading && pagination.total_items === 0}
          emptyMessage="No eligible items to add."
        >
          {items.map((option) => {
            const id = groupAddOptionId(option);
            const hint = groupAddOptionHint(option);
            return (
              <div
                key={id}
                className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {groupAddOptionLabel(
                      option,
                      duplicateWorkspaceNames,
                      multiOwnerWorkspaceOptions
                    )}
                  </p>
                  {hint ? (
                    <p className="truncate text-xs text-muted-foreground">{hint}</p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 gap-1"
                  disabled={pendingId === id}
                  onClick={() => void handleAdd(option)}
                >
                  {pendingId === id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Add
                </Button>
              </div>
            );
          })}
        </PaginatedMemberList>
      )}
    </div>
  );
}
