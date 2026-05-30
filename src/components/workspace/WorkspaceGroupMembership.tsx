"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  addWorkspaceToGroup,
  isWorkspaceGroup,
  removeWorkspaceFromGroup,
} from "@/database/workspaceStorage";
import { useWorkspace } from "@/context/WorkspaceContext";
import { isSelectableGroup } from "@/lib/viewScope";
import { formatGroupTag } from "@/lib/groupTag";
import { metaDescription } from "@/lib/resourceMeta";
import GroupAssignmentList from "@/components/workspace/GroupAssignmentList";

interface WorkspaceGroupMembershipProps {
  workspaceName: string;
  memberGroups: string[];
  onMembershipChanged?: () => void;
  disabled?: boolean;
}

export default function WorkspaceGroupMembership({
  workspaceName,
  memberGroups,
  onMembershipChanged,
  disabled = false,
}: WorkspaceGroupMembershipProps) {
  const { groups, refreshGroups } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [localMemberSet, setLocalMemberSet] = useState<Set<string>>(new Set());

  const memberSet = useMemo(
    () => new Set(memberGroups.filter(isSelectableGroup)),
    [memberGroups]
  );

  useEffect(() => {
    if (open) {
      setLocalMemberSet(new Set(memberSet));
    }
  }, [open, memberSet]);

  const groupItems = useMemo(
    () =>
      groups
        .filter(isWorkspaceGroup)
        .map((g) => {
          const desc = metaDescription(g);
          const hintParts = [
            formatGroupTag(g.tag),
            desc ? "desc" : null,
            `${g.member_count} ws`,
          ].filter(Boolean);
          return {
            id: g.name,
            label: g.name,
            hint: hintParts.join(" · "),
          };
        }),
    [groups]
  );

  const handleToggle = useCallback(
    async (groupName: string, checked: boolean) => {
      setPending(groupName);
      try {
        if (checked) {
          await addWorkspaceToGroup(groupName, workspaceName);
          setLocalMemberSet((prev) => new Set(prev).add(groupName));
          toast.success(`Added to "${groupName}".`);
        } else {
          await removeWorkspaceFromGroup(groupName, workspaceName);
          setLocalMemberSet((prev) => {
            const next = new Set(prev);
            next.delete(groupName);
            return next;
          });
          toast.success(`Removed from "${groupName}".`);
        }
        await refreshGroups();
        onMembershipChanged?.();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to update group membership."
        );
      } finally {
        setPending(null);
      }
    },
    [workspaceName, refreshGroups, onMembershipChanged]
  );

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <Users className="h-4 w-4" />
        Groups ({memberSet.size})
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="sm:max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>Group membership</DialogTitle>
            <DialogDescription>
              Choose which groups include workspace{" "}
              <span className="font-medium text-foreground">{workspaceName}</span>.
              Use <strong>Groups</strong> in the toolbar to create groups or bulk-assign
              many workspaces.
            </DialogDescription>
          </DialogHeader>

          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No groups yet. Open <strong>Groups</strong> from the toolbar to create one.
            </p>
          ) : (
            <GroupAssignmentList
              items={groupItems}
              selectedIds={localMemberSet}
              onToggle={(id, checked) => void handleToggle(id, checked)}
              pendingId={pending}
              disabled={!!pending}
              searchPlaceholder="Search groups…"
              emptyMessage="No groups."
              heightClass="h-56"
            />
          )}

          {pending && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Updating…
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
