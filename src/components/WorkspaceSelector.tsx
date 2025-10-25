"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { getWorkspaces, deleteWorkspace } from "@/database/workspaceStorage";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Trash2, Loader2, RefreshCw, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import CreateWorkspaceDialog from "./CreateWorkspaceDialog";
import OpenWorkspaceDialog from "./OpenWorkspaceDialog";
import DeleteConfirmationDialog from "./DeleteConfirmationDialog";

const WorkspaceSelector: React.FC = () => {
  const { currentWorkspace, setCurrentWorkspace } = useWorkspace();
  
  const [isCreateWorkspaceDialogOpen, setIsCreateWorkspaceDialogOpen] = useState(false);
  const [isOpenWorkspaceDialogOpen, setIsOpenWorkspaceDialogOpen] = useState(false);
  const [isDeleteWorkspaceDialogOpen, setIsDeleteWorkspaceDialogOpen] = useState(false);

  const [existingWorkspaces, setExistingWorkspaces] = useState<string[]>([]);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);

  const fetchWorkspaces = useCallback(async () => {
    setIsLoadingWorkspaces(true);
    try {
      const loadedWorkspaces = await getWorkspaces();
      setExistingWorkspaces(loadedWorkspaces);

      let newCurrentWorkspace = currentWorkspace;

      if (loadedWorkspaces.length > 0) {
        // If current workspace is null or no longer exists, default to the first one
        if (currentWorkspace === null || !loadedWorkspaces.includes(currentWorkspace)) {
          newCurrentWorkspace = loadedWorkspaces[0];
        }
      } else {
        newCurrentWorkspace = null;
      }

      setCurrentWorkspace(newCurrentWorkspace);
      return true;
    } catch (error) {
      toast.error("Failed to load workspaces from the API.");
      console.error(error);
      return false;
    } finally {
      setIsLoadingWorkspaces(false);
    }
  }, [currentWorkspace, setCurrentWorkspace]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const handleRefresh = async () => {
    const success = await fetchWorkspaces();
    if (success) {
      toast.info("Workspaces refreshed from API.");
    }
  };

  const handleCreateWorkspace = (name: string) => {
    fetchWorkspaces();
    setCurrentWorkspace(name);
    toast.success(`Workspace "${name}" created and opened.`);
  };

  const handleSelectWorkspace = (workspaceName: string) => {
    toast.success(`Selected workspace: ${workspaceName}`);
    setCurrentWorkspace(workspaceName);
    setIsOpenWorkspaceDialogOpen(false);
  };

  const handleDeleteWorkspace = async () => {
    if (!currentWorkspace) return;

    const workspaceToDelete = currentWorkspace;
    const loadingToastId = toast.loading(`Deleting workspace ${workspaceToDelete}...`);

    try {
      await deleteWorkspace(workspaceToDelete);
      toast.success(`Workspace "${workspaceToDelete}" deleted successfully.`, { id: loadingToastId });

      setCurrentWorkspace(null);
      fetchWorkspaces();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error during deletion.";
      toast.error(`Deletion failed: ${errorMessage}`, { id: loadingToastId });
    } finally {
      setIsDeleteWorkspaceDialogOpen(false);
    }
  };

  return (
    <>
      <div className="flex items-center space-x-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleRefresh}
          disabled={isLoadingWorkspaces}
        >
          <RefreshCw className={isLoadingWorkspaces ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              type="button" 
              variant="secondary" 
              disabled={isLoadingWorkspaces}
              className="flex items-center space-x-2"
            >
              <span className="font-medium">
                {isLoadingWorkspaces ? "Loading..." : currentWorkspace || "Select Workspace"}
              </span>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsCreateWorkspaceDialogOpen(true)}>
              + Create New
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsOpenWorkspaceDialogOpen(true)}>
              Open Existing
            </DropdownMenuItem>

            {currentWorkspace && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setIsDeleteWorkspaceDialogOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Current Workspace
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CreateWorkspaceDialog
        isOpen={isCreateWorkspaceDialogOpen}
        onClose={() => setIsCreateWorkspaceDialogOpen(false)}
        onCreate={handleCreateWorkspace}
      />

      <OpenWorkspaceDialog
        isOpen={isOpenWorkspaceDialogOpen}
        onClose={() => setIsOpenWorkspaceDialogOpen(false)}
        existingWorkspaces={existingWorkspaces}
        onSelect={handleSelectWorkspace}
        currentWorkspace={currentWorkspace}
      />

      {currentWorkspace && (
        <DeleteConfirmationDialog
          isOpen={isDeleteWorkspaceDialogOpen}
          onClose={() => setIsDeleteWorkspaceDialogOpen(false)}
          onConfirm={handleDeleteWorkspace}
          title={`Delete Workspace: ${currentWorkspace}`}
          description={`This action will permanently delete the entire workspace "${currentWorkspace}" and all its associated files. This action cannot be undone.`}
          itemName={currentWorkspace}
        />
      )}
    </>
  );
};

export default WorkspaceSelector;