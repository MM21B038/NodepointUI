"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { getWorkspaces } from "@/database/workspaceStorage";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, Settings, Plus } from "lucide-react";
import { toast } from "sonner";
import CreateWorkspaceDialog from "./CreateWorkspaceDialog";
import ManageWorkspacesDialog from "./ManageWorkspacesDialog";

const WorkspaceSelector = () => {
  const { currentWorkspace, setCurrentWorkspace } = useWorkspace();
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);

  const fetchWorkspaces = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await getWorkspaces();
      setWorkspaces(list);
      
      // If the current workspace is no longer in the list, clear it
      if (currentWorkspace && !list.includes(currentWorkspace)) {
        setCurrentWorkspace(null);
      }
      
      // If no workspace is selected, default to the first one if available
      if (!currentWorkspace && list.length > 0) {
        setCurrentWorkspace(list[0]);
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

  const handleSelectChange = (value: string) => {
    setCurrentWorkspace(value);
  };

  const handleWorkspaceCreated = (newWorkspaceName: string) => {
    // Refresh list and set the new workspace as current
    fetchWorkspaces().then(() => {
      setCurrentWorkspace(newWorkspaceName);
    });
  };

  const handleWorkspaceDeleted = (deletedName: string) => {
    // Refresh list
    fetchWorkspaces().then(() => {
      if (currentWorkspace === deletedName) {
        // If the current workspace was deleted, clear selection
        setCurrentWorkspace(null);
      }
    });
  };

  return (
    <div className="flex items-center space-x-2">
      <Select value={currentWorkspace || ""} onValueChange={handleSelectChange}>
        <SelectTrigger className="w-[200px] bg-card text-foreground hover:bg-card/90">
          <SelectValue placeholder="Select Workspace" />
        </SelectTrigger>
        <SelectContent>
          {workspaces.length === 0 ? (
            <SelectItem value="no-workspace" disabled>No Workspaces Found</SelectItem>
          ) : (
            workspaces.map(ws => (
              <SelectItem key={ws} value={ws}>
                {ws}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      <Button 
        variant="secondary" 
        size="icon" 
        onClick={() => setIsCreateDialogOpen(true)}
        title="Create New Workspace"
      >
        <Plus className="h-4 w-4" />
      </Button>

      <Button 
        variant="secondary" 
        size="icon" 
        onClick={() => setIsManageDialogOpen(true)}
        title="Manage Workspaces"
        disabled={workspaces.length === 0}
      >
        <Settings className="h-4 w-4" />
      </Button>

      <Button 
        variant="secondary" 
        size="icon" 
        onClick={fetchWorkspaces} 
        disabled={isLoading}
        title="Refresh Workspaces"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
      </Button>

      <CreateWorkspaceDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreate={handleWorkspaceCreated}
      />

      <ManageWorkspacesDialog
        isOpen={isManageDialogOpen}
        onClose={() => setIsManageDialogOpen(false)}
        workspaces={workspaces}
        currentWorkspace={currentWorkspace}
        onWorkspaceDeleted={handleWorkspaceDeleted}
      />
    </div>
  );
};

export default WorkspaceSelector;