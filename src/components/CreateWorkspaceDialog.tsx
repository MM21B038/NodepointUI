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
import { createWorkspace } from "@/database/workspaceStorage"; // Updated import

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
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    const name = workspaceName.trim();
    
    if (!name) {
      toast.error("Workspace name cannot be empty.");
      return;
    }
    
    setIsLoading(true);
    
    try {
      const success = await createWorkspace(name);

      if (success) {
        onCreate(name);
        setWorkspaceName("");
        onClose();
      } else {
        // If creation failed, it means the workspace already exists (based on API logic)
        toast.error(`Workspace "${name}" already exists. Please choose another name.`);
      }
    } catch (error) {
      toast.error("An unexpected error occurred while creating the workspace.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Workspace</DialogTitle>
          <DialogDescription>
            Enter a name for your new workspace. This will create a new
            directory on the server.
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
              disabled={isLoading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateWorkspaceDialog;