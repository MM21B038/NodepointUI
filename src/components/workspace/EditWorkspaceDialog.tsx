"use client";

import { useEffect, useState } from "react";
import { FolderCog, Loader2 } from "lucide-react";
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

export interface EditWorkspaceFormValues {
  name: string;
  tag: string | null;
  description: string | null;
  clearTag: boolean;
  clearDescription: boolean;
}

interface EditWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceName: string;
  initialTag?: string | null;
  initialDescription?: string | null;
  onSave: (values: EditWorkspaceFormValues) => Promise<void>;
  isSaving?: boolean;
}

export default function EditWorkspaceDialog({
  open,
  onOpenChange,
  workspaceName,
  initialTag = null,
  initialDescription = null,
  onSave,
  isSaving = false,
}: EditWorkspaceDialogProps) {
  const [name, setName] = useState(workspaceName);
  const [tag, setTag] = useState(initialTag ?? "");
  const [description, setDescription] = useState(initialDescription ?? "");

  useEffect(() => {
    if (open) {
      setName(workspaceName);
      setTag(initialTag ?? "");
      setDescription(initialDescription ?? "");
    }
  }, [open, workspaceName, initialTag, initialDescription]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const trimmedTag = tag.trim();
    const trimmedDescription = description.trim();
    await onSave({
      name: trimmed,
      tag: trimmedTag || null,
      description: trimmedDescription || null,
      clearTag: !trimmedTag && Boolean(initialTag),
      clearDescription: !trimmedDescription && Boolean(initialDescription),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderCog className="h-5 w-5 text-muted-foreground" />
            Edit workspace
          </DialogTitle>
          <DialogDescription>
            Update name, tag, or description. Leave tag or description empty and save to clear them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="workspace-edit-name">Name</Label>
            <Input
              id="workspace-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSaving}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="workspace-edit-tag">Tag</Label>
            <Input
              id="workspace-edit-tag"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="Optional label"
              disabled={isSaving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="workspace-edit-description">Description</Label>
            <Textarea
              id="workspace-edit-description"
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
