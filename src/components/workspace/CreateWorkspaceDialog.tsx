"use client";

import { useEffect, useMemo, useState } from "react";
import { FolderPlus, Loader2 } from "lucide-react";
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
import { useWorkspace } from "@/context/WorkspaceContext";
import GroupAssignmentList from "@/components/workspace/GroupAssignmentList";

interface CreateWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, groupNames: string[]) => Promise<void>;
  isCreating?: boolean;
}

export default function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onCreate,
  isCreating = false,
}: CreateWorkspaceDialogProps) {
  const { groups } = useWorkspace();
  const [name, setName] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) {
      setName("");
      setSelectedGroups(new Set());
    }
  }, [open]);

  const groupItems = useMemo(
    () =>
      groups.map((g) => ({
        id: g.name,
        label: g.name,
        hint: `${g.workspace_count} ws`,
      })),
    [groups]
  );

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await onCreate(trimmed, Array.from(selectedGroups));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-muted-foreground" />
            New workspace
          </DialogTitle>
          <DialogDescription>
            Create a workspace for documents and knowledge graph data. Optionally
            add it to one or more groups for group-scoped chat and KG.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="workspace-create-name">Name</Label>
            <Input
              id="workspace-create-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. research, legal, ops"
              disabled={isCreating}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) void handleSubmit();
              }}
            />
          </div>

          {groups.length > 0 && (
            <div className="space-y-2">
              <Label>Add to groups (optional)</Label>
              <GroupAssignmentList
                items={groupItems}
                selectedIds={selectedGroups}
                onToggle={(id, checked) => {
                  setSelectedGroups((prev) => {
                    const next = new Set(prev);
                    if (checked) next.add(id);
                    else next.delete(id);
                    return next;
                  });
                }}
                disabled={isCreating}
                searchPlaceholder="Search groups…"
                emptyMessage="No groups yet."
                maxHeightClass="max-h-40"
              />
            </div>
          )}
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
              "Create workspace"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
