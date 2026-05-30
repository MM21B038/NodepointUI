"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { getGroup, normalizeGroupTag, type GroupTag } from "@/database/workspaceStorage";
import { GroupMembersHeader } from "@/components/group/members/GroupMembersHeader";
import { WorkspaceMembersPanel } from "@/components/group/members/WorkspaceMembersPanel";
import { FilesMembersPanel } from "@/components/group/members/FilesMembersPanel";
import { EntitiesMembersPanel } from "@/components/group/members/EntitiesMembersPanel";
import { RelationsMembersPanel } from "@/components/group/members/RelationsMembersPanel";
import { useWorkspace } from "@/context/WorkspaceContext";

interface GroupMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupName: string | null;
  onChanged?: () => void;
}

export default function GroupMembersDialog({
  open,
  onOpenChange,
  groupName,
  onChanged,
}: GroupMembersDialogProps) {
  const { refreshGroups } = useWorkspace();
  const [tag, setTag] = useState<GroupTag>("workspace");
  const [description, setDescription] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [loadingMeta, setLoadingMeta] = useState(false);

  const loadMeta = useCallback(async (name: string, options?: { showSpinner?: boolean }) => {
    const showSpinner = options?.showSpinner !== false;
    if (showSpinner) setLoadingMeta(true);
    try {
      const detail = await getGroup(name, { page: 1, page_size: 1 });
      setTag(normalizeGroupTag(detail.tag));
      setDescription(detail.description ?? null);
      setMemberCount(detail.member_count);
    } catch (error) {
      console.error(error);
      if (showSpinner) toast.error(`Failed to load "${name}".`);
    } finally {
      if (showSpinner) setLoadingMeta(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !groupName) {
      setTag("workspace");
      setDescription(null);
      setMemberCount(0);
      return;
    }
    void loadMeta(groupName);
  }, [open, groupName, loadMeta]);

  const handleChanged = () => {
    onChanged?.();
    void refreshGroups();
    if (groupName) void loadMeta(groupName, { showSpinner: false });
  };

  if (!groupName) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(85vh,640px)] max-w-lg flex-col overflow-hidden sm:max-w-xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            Manage members
          </DialogTitle>
          <DialogDescription>
            Add or remove members for this group. Available actions depend on the group type.
          </DialogDescription>
        </DialogHeader>

        {loadingMeta ? (
          <div className="flex flex-1 justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            <GroupMembersHeader
              groupName={groupName}
              tag={tag}
              description={description}
              memberCount={memberCount}
            />
            {tag === "workspace" ? (
              <WorkspaceMembersPanel groupName={groupName} onChanged={handleChanged} />
            ) : tag === "files" ? (
              <FilesMembersPanel groupName={groupName} onChanged={handleChanged} />
            ) : tag === "entity" ? (
              <EntitiesMembersPanel groupName={groupName} onChanged={handleChanged} />
            ) : (
              <RelationsMembersPanel groupName={groupName} onChanged={handleChanged} />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
