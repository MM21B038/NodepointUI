"use client";

import React, { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import CreateWorkspaceDialog from "@/components/CreateWorkspaceDialog";

const Documents = () => {
  const [isCreateWorkspaceDialogOpen, setIsCreateWorkspaceDialogOpen] = useState(false);
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null);
  const [existingWorkspaces, setExistingWorkspaces] = useState<string[]>([]);

  // Simulate fetching workspaces from a backend
  useEffect(() => {
    const fetchWorkspaces = async () => {
      // In a real app, this would be an API call to list directories in 'database/'
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate network delay
      setExistingWorkspaces(["Project Alpha", "Project Beta", "Project Gamma"]);
      // Set a default workspace if none is selected
      if (!currentWorkspace && existingWorkspaces.length > 0) {
        setCurrentWorkspace(existingWorkspaces[0]);
      }
    };
    fetchWorkspaces();
  }, [currentWorkspace, existingWorkspaces.length]); // Re-run if currentWorkspace or initial existingWorkspaces change

  const handleRefresh = () => {
    toast.info("Refreshing documents...");
    // TODO: Implement actual data refresh logic (requires backend)
    console.log("Refreshing documents");
    // In a real app, this would also re-fetch workspaces
  };

  const handleCreateWorkspace = (name: string) => {
    // In a real app, this would be an API call to create a directory
    toast.success(`Simulating creation of workspace: ${name}`);
    setExistingWorkspaces((prev) => [...prev, name]);
    setCurrentWorkspace(name); // Automatically switch to the new workspace
    console.log(`Creating new workspace: ${name}`);
  };

  const handleSelectWorkspace = (workspaceName: string) => {
    toast.success(`Selected workspace: ${workspaceName}`);
    setCurrentWorkspace(workspaceName);
    // TODO: Implement logic to switch to selected workspace (requires backend)
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
              <Button variant="outline">Workspace Options</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsCreateWorkspaceDialogOpen(true)}>
                + Create New Workspace
              </DropdownMenuItem>
              {existingWorkspaces.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  {existingWorkspaces.map((workspace) => (
                    <DropdownMenuItem
                      key={workspace}
                      onClick={() => handleSelectWorkspace(workspace)}
                      className={currentWorkspace === workspace ? "bg-accent text-accent-foreground" : ""}
                    >
                      {workspace}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              {existingWorkspaces.length === 0 && (
                <DropdownMenuItem disabled>No existing workspaces</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="border rounded-lg p-6 bg-card text-card-foreground min-h-[300px] flex items-center justify-center">
        <p className="text-muted-foreground">
          {currentWorkspace
            ? `Displaying documents for workspace: ${currentWorkspace}. (Requires backend to fetch data)`
            : "Please create or select a workspace to view documents."}
        </p>
      </div>

      <CreateWorkspaceDialog
        isOpen={isCreateWorkspaceDialogOpen}
        onClose={() => setIsCreateWorkspaceDialogOpen(false)}
        onCreate={handleCreateWorkspace}
      />
    </div>
  );
};

export default Documents;