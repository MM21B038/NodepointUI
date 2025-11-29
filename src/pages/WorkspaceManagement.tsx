"use client";

import React, { useState, useEffect, useCallback } from "react";
import { FolderCog, Info, Loader2, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWorkspace } from "@/context/WorkspaceContext";
import { getWorkspaces, deleteWorkspace } from "@/database/workspaceStorage";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import DeleteConfirmationDialog from "@/components/DeleteConfirmationDialog";

const WorkspaceManagement = () => {
  const { currentWorkspace, setCurrentWorkspace } = useWorkspace();
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchWorkspaces = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await getWorkspaces();
      list.sort((a, b) => b.localeCompare(a));
      setWorkspaces(list);

      if (currentWorkspace && !list.includes(currentWorkspace)) {
        setCurrentWorkspace(null);
      }
      if (!currentWorkspace && list.length > 0) {
        setCurrentWorkspace(list[0]);
      } else if (list.length === 0) {
        setCurrentWorkspace(null);
      }
    } catch (error) {
      console.error("Failed to fetch workspaces:", error);
      toast.error("Failed to load workspaces.");
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace, setCurrentWorkspace]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const handleSelectWorkspace = (workspaceName: string) => {
    setCurrentWorkspace(workspaceName);
    toast.success(`Switched to workspace: ${workspaceName}`);
  };

  const handleDeleteClick = (workspaceName: string) => {
    setWorkspaceToDelete(workspaceName);
    setIsDeleteDialogOpen(true);
  };

  const executeDeleteWorkspace = useCallback(async () => {
    if (!workspaceToDelete) return;

    setIsDeleting(true);
    const loadingToastId = toast.loading(`Deleting workspace ${workspaceToDelete}...`);

    try {
      await deleteWorkspace(workspaceToDelete);
      toast.success(`Workspace "${workspaceToDelete}" deleted successfully.`, { id: loadingToastId });
      fetchWorkspaces();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error during deletion.";
      toast.error(`Deletion failed: ${errorMessage}`, { id: loadingToastId });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setWorkspaceToDelete(null);
    }
  }, [workspaceToDelete, fetchWorkspaces]);

  return (
    <div className="flex flex-col h-full flex-grow">
      <Card className="flex-grow flex flex-col">
        <CardHeader>
          <CardTitle>Workspace List</CardTitle> {/* Changed title here */}
        </CardHeader>
        <CardContent className="flex-grow flex flex-col p-2"> {/* Reduced padding here */}
          {isLoading ? (
            <div className="flex-grow flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading workspaces...</span>
            </div>
          ) : workspaces.length === 0 ? (
            <div className="flex-grow flex items-center justify-center">
              <Alert className="max-w-lg">
                <Info className="h-4 w-4" />
                <AlertTitle>No Workspaces Found</AlertTitle>
                <AlertDescription>
                  It looks like you don't have any workspaces yet. Use the controls in the navigation bar to create one!
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <ScrollArea className="flex-grow h-0 rounded-md border hide-scrollbar">
              <ul className="divide-y">
                {workspaces.map((workspace) => (
                  <li
                    key={workspace}
                    className={cn(
                      "flex items-center justify-between p-2 transition-colors cursor-pointer",
                      currentWorkspace === workspace
                        ? "bg-secondary text-secondary-foreground"
                        : "hover:bg-accent/50",
                    )}
                    onClick={() => handleSelectWorkspace(workspace)}
                  >
                    <span
                      className={cn(
                        "font-medium truncate flex-grow",
                        currentWorkspace === workspace && "text-secondary-foreground"
                      )}
                    >
                      {workspace}
                      {currentWorkspace === workspace && " (Current)"}
                    </span>
                    <div className="flex items-center space-x-2 ml-4">
                      {currentWorkspace !== workspace && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectWorkspace(workspace);
                          }}
                          disabled={isDeleting}
                        >
                          Select
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(workspace);
                        }}
                        disabled={isDeleting}
                      >
                        {isDeleting && workspaceToDelete === workspace ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {workspaceToDelete && (
        <DeleteConfirmationDialog
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          onConfirm={executeDeleteWorkspace}
          title={`Permanently Delete Workspace: ${workspaceToDelete}`}
          description={`This action will permanently delete the workspace "${workspaceToDelete}" and all associated documents and data. This action cannot be undone.`}
          itemName={workspaceToDelete}
        />
      )}
    </div>
  );
};

export default WorkspaceManagement;