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
import OpenWorkspaceDialog from "@/components/OpenWorkspaceDialog";

const Documents = () => {
  const [isCreateWorkspaceDialogOpen, setIsCreateWorkspaceDialogOpen] = useState(false);
  const [isOpenWorkspaceDialogOpen, setIsOpenWorkspaceDialogOpen] = useState(false);
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null);
  const [existingWorkspaces, setExistingWorkspaces] = useState<string[]>([]); // Initialize as empty

  // In a real app, you would fetch existing workspaces from your backend here.
  useEffect(() => {
    // Simulate fetching workspaces from a backend if needed, but for now, it's empty.
  }, []);

  const handleRefresh = () => {
    toast.info("Refreshing documents...");
    // TODO: Implement actual data refresh logic (requires backend)
    console.log("Refreshing documents");
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
                Open Workspace
              </DropdownMenuItem>
              {/* Removed existing workspace list from dropdown */}
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