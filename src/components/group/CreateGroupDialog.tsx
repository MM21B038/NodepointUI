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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  CREATABLE_GROUP_TAGS,
  type CreatableGroupTag,
} from "@/database/workspaceStorage";
import { GroupTagDot } from "@/components/group/GroupTagBadge";
import { formatGroupTag, GROUP_TAG_DESCRIPTIONS } from "@/lib/groupTag";

export interface CreateGroupFormValues {
  name: string;
  tag: CreatableGroupTag;
  description?: string | null;
}

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (values: CreateGroupFormValues) => Promise<void>;
  isCreating?: boolean;
}

export default function CreateGroupDialog({
  open,
  onOpenChange,
  onCreate,
  isCreating = false,
}: CreateGroupDialogProps) {
  const [name, setName] = useState("");
  const [tag, setTag] = useState<CreatableGroupTag>("workspace");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) {
      setName("");
      setTag("workspace");
      setDescription("");
    }
  }, [open]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await onCreate({
      name: trimmed,
      tag,
      description: description.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-muted-foreground" />
            New group
          </DialogTitle>
          <DialogDescription>
            Choose a group type — it defines membership and what group chat can search. Type cannot
            be changed later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="group-create-name">Name</Label>
            <Input
              id="group-create-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. research, legal"
              disabled={isCreating}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="group-create-type">Type</Label>
            <Select
              value={tag}
              onValueChange={(value) => setTag(value as CreatableGroupTag)}
              disabled={isCreating}
            >
              <SelectTrigger id="group-create-type" className="h-9">
                <span className="flex items-center gap-2">
                  <GroupTagDot tag={tag} />
                  {formatGroupTag(tag)}
                </span>
              </SelectTrigger>
              <SelectContent>
                {CREATABLE_GROUP_TAGS.map((t) => (
                  <SelectItem key={t} value={t}>
                    <span className="flex items-center gap-2">
                      <GroupTagDot tag={t} />
                      {formatGroupTag(t)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{GROUP_TAG_DESCRIPTIONS[tag]}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="group-create-description">Description (optional)</Label>
            <Textarea
              id="group-create-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this group is for"
              disabled={isCreating}
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
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isCreating || !name.trim()}
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create group"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
