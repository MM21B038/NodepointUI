"use client";

import React from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator, // Added this import
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const Documents = () => {
  const handleRefresh = () => {
    toast.info("Refreshing documents...");
    // TODO: Implement actual data refresh logic (requires backend)
    console.log("Refreshing documents");
  };

  const handleCreateWorkspace = () => {
    toast.info("Creating new workspace...");
    // TODO: Implement logic to create a new subdirectory (requires backend)
    console.log("Creating new workspace");
  };

  const handleSelectWorkspace = (workspaceName: string) => {
    toast.success(`Selected workspace: ${workspaceName}`);
    // TODO: Implement logic to switch to selected workspace (requires backend)
    console.log(`Selected workspace: ${workspaceName}`);
  };

  // Placeholder for existing workspaces (would come from backend)
  const existingWorkspaces = ["Project Alpha", "Project Beta", "Project Gamma"];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-semibold">Documents</h2>
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Workspace Options</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCreateWorkspace}>
                + Create New Workspace
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {existingWorkspaces.length > 0 ? (
                existingWorkspaces.map((workspace) => (
                  <DropdownMenuItem
                    key={workspace}
                    onClick={() => handleSelectWorkspace(workspace)}
                  >
                    {workspace}
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled>No existing workspaces</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="border rounded-lg p-6 bg-card text-card-foreground min-h-[300px] flex items-center justify-center">
        <p className="text-muted-foreground">
          Table of documents will appear here. (Requires backend to fetch data from database.db and list subdirectories)
        </p>
      </div>
    </div>
  );
};

export default Documents;