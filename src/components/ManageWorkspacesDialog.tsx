"use client";

import React, { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteWorkspace } from "@/database/workspaceStorage";
import DeleteConfirmationDialog from "./DeleteConfirmationDialog";
import { cn } from "@/lib/utils";

interface ManageWorkspacesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workspaces: string[];
  currentWorkspace: string | null;
  onWorkspaceDeleted: (deletedName: string) => void;
}

const ManageWorkspacesDialog: React.FC<ManageWorkspacesDialogProps> = ({
  isOpen,
  onClose,
  workspaces,
  currentWorkspace,
  onWorkspaceDeleted,
}) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = (workspaceName: string) => {
    setWorkspaceToDelete(workspaceName);
    setIsConfirmingDelete(true);
  };

  const handleConfirmDelete = useCallback(async () => {
    if (!workspaceToDelete) return;

    setIsDeleting(true);
    const loadingToastId = toast.loading(`Deleting workspace ${workspaceToDelete}...`);

    try {
      await deleteWorkspace(workspaceToDelete);
      toast.success(`Workspace "${workspaceToDelete}" deleted successfully.`, { id: loadingToastId });
      onWorkspaceDeleted(workspaceToDelete);
      onClose(); // Close the main dialog after successful deletion
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error during deletion.";
      toast.error(`Deletion failed: ${errorMessage}`, { id: loadingToastId });
    } finally {
      setIsDeleting(false);
      setIsConfirmingDelete(false);
      setWorkspaceToDelete(null);
    }
  }, [workspaceToDelete, onWorkspaceDeleted, onClose]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Manage Workspaces</DialogTitle>
            <DialogDescription>
              View and delete existing workspaces. Deleting a workspace is permanent.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {workspaces.length === 0 ? (
              <p className="text-center text-muted-foreground">
                No existing workspaces found.
              </p>
            ) : (
              <ScrollArea className="h-64 w-full rounded-md border">
                <ul className="divide-y">
                  {workspaces.map((workspace) => (
                    <li
                      key={workspace}
                      className={cn(
                        "flex items-center justify-between p-3 transition-colors",
                        currentWorkspace === workspace ? "bg-secondary/50" : "hover:bg-accent/50",
                      )}
                    >
                      <span className={cn(
                        "font-medium truncate",
                        currentWorkspace === workspace && "text-primary"
                      )}>
                        {workspace}
                        {currentWorkspace === workspace && " (Current)"}
                      </span>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDeleteClick(workspace)}
                        disabled={isDeleting}
                      >
                        {isDeleting && workspaceToDelete === workspace ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Deletion */}
      {workspaceToDelete && (
        <DeleteConfirmationDialog
          isOpen={isConfirmingDelete}
          onClose={() => setIsConfirmingDelete(false)}
          onConfirm={handleConfirmDelete}
          title={`Permanently Delete Workspace: ${workspaceToDelete}`}
          description={`This action will permanently delete the workspace "${workspaceToDelete}" and all associated documents and data. This action cannot be undone.`}
          itemName={workspaceToDelete}
        />
      )}
    </>
  );
};

export default ManageWorkspacesDialog;