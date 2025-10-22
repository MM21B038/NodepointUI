"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CreateWorkspaceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (workspaceName: string) => void;
}

const CreateWorkspaceDialog: React.FC<CreateWorkspaceDialogProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [workspaceName, setWorkspaceName] = useState("");

  const handleSubmit = () => {
    if (workspaceName.trim()) {
      onCreate(workspaceName.trim());
      setWorkspaceName("");
      onClose();
    } else {
      toast.error("Workspace name cannot be empty.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Workspace</DialogTitle>
          <DialogDescription>
            Enter a name for your new workspace. This will create a new
            directory.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              className="col-span-3"
              placeholder="e.g., My Project"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateWorkspaceDialog;