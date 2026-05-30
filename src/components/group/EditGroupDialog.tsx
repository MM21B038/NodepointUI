"use client";

import { useEffect, useState } from "react";
import { FolderKanban, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GroupTagBadge } from "@/components/group/GroupTagBadge";
import type { GroupTag } from "@/database/workspaceStorage";
import { GROUP_TAG_DESCRIPTIONS } from "@/lib/groupTag";

export interface EditGroupFormValues {
  name: string;
  description: string | null;
  clearDescription: boolean;
}

interface EditGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupName: string;
  groupTag: GroupTag;
  initialDescription?: string | null;
  onSave: (values: EditGroupFormValues) => Promise<void>;
  isSaving?: boolean;
}

export default function EditGroupDialog({
  open,
  onOpenChange,
  groupName,
  groupTag,
  initialDescription = null,
  onSave,
  isSaving = false,
}: EditGroupDialogProps) {
  const [name, setName] = useState(groupName);
  const [description, setDescription] = useState(initialDescription ?? "");

  useEffect(() => {
    if (open) {
      setName(groupName);
      setDescription(initialDescription ?? "");
    }
  }, [open, groupName, initialDescription]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const trimmedDescription = description.trim();
    await onSave({
      name: trimmed,
      description: trimmedDescription || null,
      clearDescription: !trimmedDescription && Boolean(initialDescription),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-muted-foreground" />
            Edit group
          </DialogTitle>
          <DialogDescription>
            Rename the group or update its description. Group type cannot be changed after creation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Type</span>
              <GroupTagBadge tag={groupTag} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {GROUP_TAG_DESCRIPTIONS[groupTag]}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="group-edit-name">Name</Label>
            <Input
              id="group-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSaving}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="group-edit-description">Description</Label>
            <Textarea
              id="group-edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              disabled={isSaving}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSaving || !name.trim()}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
