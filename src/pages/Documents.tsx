"use client";

import React, { useState, useEffect } from "react";
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
import { getWorkspaces, createWorkspace } from "@/database/workspaceStorage";

const Documents = () => {
  const [isCreateWorkspaceDialogOpen, setIsCreateWorkspaceDialogOpen] = useState(false);
  const [isOpenWorkspaceDialogOpen, setIsOpenWorkspaceDialogOpen] = useState(false);
  const [existingWorkspaces, setExistingWorkspaces] = useState<string[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null);

  // Load existing workspaces and set initial current workspace
  useEffect(() => {
    const loadedWorkspaces = getWorkspaces();
    setExistingWorkspaces(loadedWorkspaces);
    
    // Set the first workspace as current if none is selected yet
    if (loadedWorkspaces.length > 0 && currentWorkspace === null) {
      setCurrentWorkspace(loadedWorkspaces[0]);
    }
  }, []);

  const handleRefresh = () => {
    // Reload workspaces from storage
    const refreshedWorkspaces = getWorkspaces();
    setExistingWorkspaces(refreshedWorkspaces);
    toast.info("Workspaces refreshed.");
    console.log("Refreshing documents/workspaces");
  };

  const handleCreateWorkspace = (name: string) => {
    // This function is called only if workspaceExists check passed in the dialog
    const success = createWorkspace(name);
    
    if (success) {
      // Update local state and set as current
      const updatedWorkspaces = getWorkspaces();
      setExistingWorkspaces(updatedWorkspaces);
      setCurrentWorkspace(name); 
      toast.success(`Workspace "${name}" created and opened.`);
    } else {
      // Should not happen if dialog check is correct, but good fallback
      toast.error(`Failed to create workspace "${name}". It might already exist.`);
    }
  };

  const handleSelectWorkspace = (workspaceName: string) => {
    toast.success(`Selected workspace: ${workspaceName}`);
    setCurrentWorkspace(workspaceName);
    setIsOpenWorkspaceDialogOpen(false); // Close dialog after selection
    console.log(`Selected workspace: ${workspaceName}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-semibold">
          Documents {currentWorkspace && `(${currentWorkspace})`}
        </h2>
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Workspace</Button>
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
        <p className="text-muted-foreground">
          {currentWorkspace
            ? `Displaying documents for workspace: ${currentWorkspace}. (Requires backend to fetch data)`
            : "Please create or open a workspace to view documents."}
        </p>
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