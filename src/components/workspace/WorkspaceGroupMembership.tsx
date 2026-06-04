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
  removeWorkspaceFromGroup,
} from "@/database/workspaceStorage";
import { useWorkspace } from "@/context/WorkspaceContext";
import WorkspaceGroupOptionsList from "@/components/workspace/WorkspaceGroupOptionsList";
import {
  formatScopedResourceLabel,
  groupResourceKey,
  ownerParamsFrom,
  parseResourceKey,
} from "@/lib/ownerScope";

interface WorkspaceGroupMembershipProps {
  workspaceName: string;
  workspaceOwnerId?: number;
  workspaceOwnerUsername?: string | null;
  memberGroups: string[];
  onMembershipChanged?: () => void;
  disabled?: boolean;
}

export default function WorkspaceGroupMembership({
  workspaceName,
  workspaceOwnerId,
  workspaceOwnerUsername,
  memberGroups,
  onMembershipChanged,
  disabled = false,
}: WorkspaceGroupMembershipProps) {
  const { refreshGroups } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [localMemberSet, setLocalMemberSet] = useState<Set<string>>(new Set());

  const workspaceOwner = useMemo(
    () =>
      ownerParamsFrom({
        name: workspaceName,
        owner_id: workspaceOwnerId,
        owner_username: workspaceOwnerUsername,
      }),
    [workspaceName, workspaceOwnerId, workspaceOwnerUsername]
  );

  const memberSet = useMemo(() => {
    const keys = new Set<string>();
    for (const gName of memberGroups) {
      keys.add(groupResourceKey(gName, workspaceOwnerId ?? undefined));
    }
    return keys;
  }, [memberGroups, workspaceOwnerId]);

  useEffect(() => {
    if (open) {
      setLocalMemberSet(new Set(memberSet));
    }
  }, [open, memberSet]);

  const handleToggle = useCallback(
    async (groupKey: string, checked: boolean) => {
      const { name: groupName, ownerId: groupOwnerId } =
        parseResourceKey(groupKey);
      const groupOwner =
        groupOwnerId != null ? { ownerId: groupOwnerId } : undefined;

      setPending(groupKey);
      try {
        const mutation = {
          groupOwner,
          workspaceOwner,
        };
        if (checked) {
          await addWorkspaceToGroup(groupName, workspaceName, mutation);
          setLocalMemberSet((prev) => new Set(prev).add(groupKey));
          toast.success("Added to group.");
        } else {
          await removeWorkspaceFromGroup(groupName, workspaceName, mutation);
          setLocalMemberSet((prev) => {
            const next = new Set(prev);
            next.delete(groupKey);
            return next;
          });
          toast.success(`Removed from group.`);
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
    [workspaceName, workspaceOwner, refreshGroups, onMembershipChanged]
  );

  const workspaceLabel = formatScopedResourceLabel(
    workspaceName,
    workspaceOwnerUsername,
    { forceOwner: Boolean(workspaceOwnerUsername) }
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
              <span className="font-medium text-foreground">{workspaceLabel}</span>.
              Groups you already belong to are checked and cannot be removed here.
            </DialogDescription>
          </DialogHeader>

          <WorkspaceGroupOptionsList
            workspaceName={workspaceName}
            workspaceOwner={workspaceOwner}
            selectedIds={localMemberSet}
            enabled={open}
            onToggle={(id, checked) => void handleToggle(id, checked)}
            pendingId={pending}
            disabled={!!pending}
            heightClass="h-56"
          />

          {pending ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Updating…
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
