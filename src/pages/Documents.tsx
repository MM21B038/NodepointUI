"use client";

import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import CreateWorkspaceDialog from "@/components/CreateWorkspaceDialog";
import OpenWorkspaceDialog from "@/components/OpenWorkspaceDialog";
import { getWorkspaces } from "@/database/workspaceStorage";

const Documents = () => {
  const [isCreateWorkspaceDialogOpen, setIsCreateWorkspaceDialogOpen] = useState(false);
  const [isOpenWorkspaceDialogOpen, setIsOpenWorkspaceDialogOpen] = useState(false);
  const [existingWorkspaces, setExistingWorkspaces] = useState<string[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);

  const fetchWorkspaces = useCallback(async () => {
    setIsLoadingWorkspaces(true);
    try {
      const loadedWorkspaces = await getWorkspaces();
      setExistingWorkspaces(loadedWorkspaces);
      
      // If the current workspace is no longer in the list, or if none is selected,
      // set the first one as current if available.
      if (
        loadedWorkspaces.length > 0 &&
        (currentWorkspace === null || !loadedWorkspaces.includes(currentWorkspace))
      ) {
        setCurrentWorkspace(loadedWorkspaces[0]);
      } else if (loadedWorkspaces.length === 0) {
        setCurrentWorkspace(null);
      }
      
      return true;
    } catch (error) {
      toast.error("Failed to load workspaces from the API.");
      console.error(error);
      return false;
    } finally {
      setIsLoadingWorkspaces(false);
    }
  }, [currentWorkspace]);

  // Load existing workspaces on mount
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
    // After successful creation via API (handled in dialog), refresh the list
    fetchWorkspaces();
    setCurrentWorkspace(name); 
    toast.success(`Workspace "${name}" created and opened.`);
  };

  const handleSelectWorkspace = (workspaceName: string) => {
    toast.success(`Selected workspace: ${workspaceName}`);
    setCurrentWorkspace(workspaceName);
    setIsOpenWorkspaceDialogOpen(false); // Close dialog after selection
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-semibold">
          Documents {currentWorkspace && `(${currentWorkspace})`}
        </h2>
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoadingWorkspaces}>
            <RefreshCw className={isLoadingWorkspaces ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isLoadingWorkspaces}>Workspace</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsCreateWorkspaceDialogOpen(true)}>
                + Create New
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsOpenWorkspaceDialogOpen(true)}>
                Open Existing
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="border rounded-lg p-6 bg-card text-card-foreground min-h-[300px] flex items-center justify-center">
        {isLoadingWorkspaces ? (
          <p className="text-muted-foreground">Loading workspaces...</p>
        ) : currentWorkspace ? (
          <p className="text-muted-foreground">
            Displaying documents for workspace: {currentWorkspace}. (Ready to upload files)
          </p>
        ) : (
          <p className="text-muted-foreground">
            Please create or open a workspace to view documents.
          </p>
        )}
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
    </div>
  );
};

export default Documents;