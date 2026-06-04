"use client";

import { useMemo } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWorkspaceGroupOptions } from "@/hooks/useWorkspaceGroupOptions";
import { formatGroupTag } from "@/lib/groupTag";
import { metaDescription } from "@/lib/resourceMeta";
import {
  duplicateNamesInList,
  formatScopedResourceLabel,
  groupResourceKey,
  listHasMultipleOwners,
} from "@/lib/ownerScope";
import type { OwnerParams } from "@/lib/ownerScope";
import { cn } from "@/lib/utils";

interface WorkspaceGroupOptionsListProps {
  workspaceName: string;
  workspaceOwner?: OwnerParams;
  selectedIds: Set<string>;
  disabledIds?: Set<string>;
  onToggle: (groupKey: string, checked: boolean) => void;
  pendingId?: string | null;
  disabled?: boolean;
  enabled?: boolean;
  heightClass?: string;
}

export default function WorkspaceGroupOptionsList({
  workspaceName,
  workspaceOwner,
  selectedIds,
  disabledIds,
  onToggle,
  pendingId = null,
  disabled = false,
  enabled = true,
  heightClass = "h-56",
}: WorkspaceGroupOptionsListProps) {
  const { search, setSearch, groups, loading, error } = useWorkspaceGroupOptions({
    workspaceName,
    workspaceOwner,
    enabled,
    pageSize: 100,
  });

  const duplicateGroupNames = useMemo(
    () => duplicateNamesInList(groups),
    [groups]
  );

  const multiOwnerGroups = useMemo(
    () => listHasMultipleOwners(groups),
    [groups]
  );

  const sorted = useMemo(
    () =>
      [...groups].sort((a, b) => {
        const aMember = a.already_member ? 0 : 1;
        const bMember = b.already_member ? 0 : 1;
        if (aMember !== bMember) return aMember - bMember;
        return a.name.localeCompare(b.name);
      }),
    [groups]
  );

  if (loading && groups.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search groups…"
          className="h-9 pl-8"
          disabled={disabled}
        />
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {sorted.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No eligible groups.
        </p>
      ) : (
        <ScrollArea className={cn("rounded-md border border-border/50", heightClass)}>
          <ul className="p-2 space-y-1">
            {sorted.map((g) => {
              const id = groupResourceKey(g.name, g.owner_id);
              const isMember = g.already_member;
              const checked = selectedIds.has(id) || isMember;
              const rowDisabled =
                disabled ||
                isMember ||
                disabledIds?.has(id) ||
                pendingId === id;
              const label = formatScopedResourceLabel(g.name, g.owner_username, {
                duplicateNames: duplicateGroupNames,
                multiOwnerList: multiOwnerGroups,
              });
              const hintParts = [
                formatGroupTag(g.tag),
                metaDescription(g) ? "desc" : null,
                g.member_count != null ? `${g.member_count} ws` : null,
                isMember ? "member" : null,
              ].filter(Boolean);

              return (
                <li key={id}>
                  <div
                    className={cn(
                      "flex items-start gap-2 rounded-md px-2 py-2",
                      isMember && "opacity-70"
                    )}
                  >
                    <Checkbox
                      id={`wg-opt-${id}`}
                      checked={checked}
                      disabled={rowDisabled}
                      onCheckedChange={(v) => {
                        if (!isMember) onToggle(id, v === true);
                      }}
                      className="mt-0.5"
                    />
                    <Label
                      htmlFor={`wg-opt-${id}`}
                      className={cn(
                        "min-w-0 flex-1 cursor-pointer text-sm font-normal leading-snug",
                        rowDisabled && !isMember && "cursor-not-allowed opacity-60"
                      )}
                    >
                      <span className="font-medium text-foreground">{label}</span>
                      {hintParts.length > 0 ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {hintParts.join(" · ")}
                        </span>
                      ) : null}
                    </Label>
                    {pendingId === id ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}
