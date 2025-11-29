"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { getWorkspaces } from "@/database/workspaceStorage";
import { Button } from "@/components/ui/button";
import { Plus, Settings, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import CreateWorkspaceDialog from "./CreateWorkspaceDialog";
import ManageWorkspacesDialog from "./ManageWorkspacesDialog";
import WorkspaceCombobox from "./WorkspaceCombobox";
import { useLocation } from "react-router-dom"; // Import useLocation

const WorkspaceControl = () => {
  const { currentWorkspace, setCurrentWorkspace } = useWorkspace();
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);

  const location = useLocation(); // Get current location
  const hideButtonsOnPaths = ["/documents", "/knowledge-base", "/ask", "/chat"];
  // Updated logic: check if the current path starts with any of the paths in the list
  const shouldHideButtons = hideButtonsOnPaths.some(path => location.pathname.startsWith(path));

  const fetchWorkspaces = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await getWorkspaces();
      list.sort((a, b) => b.localeCompare(a)); // Sort in descending order
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
    toast.success(`Switched to workspace: ${value}`);
  };

  const handleWorkspaceCreated = (newWorkspaceName: string) => {
    fetchWorkspaces().then(() => {
      setCurrentWorkspace(newWorkspaceName);
      toast.success(`Workspace '${newWorkspaceName}' created and selected.`);
    });
  };

  const handleWorkspaceDeleted = (deletedName: string) => {
    fetchWorkspaces().then(() => {
      if (currentWorkspace === deletedName) {
        setCurrentWorkspace(null);
        toast.info(`Current workspace '${deletedName}' was deleted. Please select another.`);
      } else {
        toast.success(`Workspace '${deletedName}' deleted.`);
      }
    });
  };

  return (
    <div className="flex items-center space-x-2">
      <WorkspaceCombobox
        workspaces={workspaces}
        currentWorkspace={currentWorkspace}
        onSelectWorkspace={handleSelectChange}
        disabled={isLoading}
      />

      {!shouldHideButtons && ( // Conditionally render these buttons
        <>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setIsCreateDialogOpen(true)}
            disabled={isLoading}
            title="Create New Workspace"
          >
            <Plus className="h-4 w-4" />
          </Button>

          <Button
            variant="secondary"
            size="icon"
            onClick={() => setIsManageDialogOpen(true)}
            disabled={isLoading || workspaces.length === 0}
            title="Manage Existing Workspaces"
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
        </>
      )}

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

export default WorkspaceControl;