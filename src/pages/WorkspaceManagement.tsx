"use client";

import React, { useState, useEffect, useCallback } from "react";
import { FolderCog, Info, Loader2, Trash2, Plus, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/context/WorkspaceContext";
import { getWorkspaces, deleteWorkspace } from "@/database/workspaceStorage";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import DeleteConfirmationDialog from "@/components/DeleteConfirmationDialog";
import CreateWorkspaceDialog from "@/components/CreateWorkspaceDialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area"; // Re-import ScrollArea for CommandList

const WorkspaceManagement = () => {
  const { currentWorkspace, setCurrentWorkspace } = useWorkspace();
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchWorkspaces = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await getWorkspaces();
      list.sort((a, b) => b.localeCompare(a)); // Sort alphabetically
      setWorkspaces(list);

      // If the current workspace is no longer in the list, clear it
      if (currentWorkspace && !list.includes(currentWorkspace)) {
        setCurrentWorkspace(null);
      }
      // If no workspace is selected, default to the first one if available
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

  const handleWorkspaceCreated = (newWorkspaceName: string) => {
    fetchWorkspaces().then(() => {
      setCurrentWorkspace(newWorkspaceName);
      toast.success(`Workspace '${newWorkspaceName}' created and selected.`);
    });
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
      fetchWorkspaces(); // Re-fetch to update the list and potentially current workspace
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
    <div className="flex flex-col h-full flex-grow p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Workspace Management</h1>
        <Button onClick={() => setIsCreateDialogOpen(true)} disabled={isLoading}>
          <Plus className="mr-2 h-4 w-4" /> Create New Workspace
        </Button>
      </div>

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
              It looks like you don't have any workspaces yet. Click "Create New Workspace" to get started!
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <Command className="rounded-lg border shadow-md flex-grow bg-card">
          <CommandInput placeholder="Search workspaces..." className="px-4 py-3" />
          <CommandList className="flex-grow hide-scrollbar">
            <CommandEmpty>No matching workspaces found.</CommandEmpty>
            <CommandGroup>
              {workspaces.map((workspace) => (
                <CommandItem
                  key={workspace}
                  value={workspace} // Important for search filtering
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-accent hover:text-accent-foreground"
                  onSelect={() => handleSelectWorkspace(workspace)} // Select on item click
                >
                  <div className="flex items-center flex-grow min-w-0">
                    <FolderCog className="h-5 w-5 mr-3 text-muted-foreground" />
                    <span className={cn(
                      "font-medium truncate",
                      currentWorkspace === workspace ? "text-primary" : "text-foreground"
                    )}>
                      {workspace}
                    </span>
                    {currentWorkspace === workspace && (
                      <CheckCircle2 className="h-4 w-4 ml-2 text-primary flex-shrink-0" />
                    )}
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent selecting workspace when clicking delete
                      handleDeleteClick(workspace);
                    }}
                    disabled={isDeleting}
                    className="ml-4 flex-shrink-0"
                  >
                    {isDeleting && workspaceToDelete === workspace ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      )}

      <CreateWorkspaceDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreate={handleWorkspaceCreated}
      />

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