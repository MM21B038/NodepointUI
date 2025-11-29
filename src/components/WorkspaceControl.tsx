"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { getWorkspaces, WorkspaceEntry } from "@/database/workspaceStorage"; // Import WorkspaceEntry
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import CreateWorkspaceDialog from "./CreateWorkspaceDialog";
import WorkspaceCombobox from "./WorkspaceCombobox";
import { useLocation } from "react-router-dom";

const WorkspaceControl = () => {
  const { currentWorkspace, setCurrentWorkspace } = useWorkspace();
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const location = useLocation();
  const hideButtonsOnPaths = ["/documents", "/knowledge-base", "/ask", "/chat"];
  const shouldHideButtons = hideButtonsOnPaths.some(path => location.pathname.startsWith(path));

  const fetchWorkspaces = useCallback(async () => {
    setIsLoading(true);
    try {
      const list: WorkspaceEntry[] = await getWorkspaces(); // Expect WorkspaceEntry[]
      
      // Sort by timestamp in descending order (latest first)
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      const workspaceNames = list.map(ws => ws.workspace_name);
      setWorkspaces(workspaceNames);

      if (currentWorkspace && !workspaceNames.includes(currentWorkspace)) {
        setCurrentWorkspace(null);
      }

      if (!currentWorkspace && workspaceNames.length > 0) {
        setCurrentWorkspace(workspaceNames[0]);
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

  return (
    <div className="flex items-center space-x-2">
      <WorkspaceCombobox
        workspaces={workspaces}
        currentWorkspace={currentWorkspace}
        onSelectWorkspace={handleSelectChange}
        disabled={isLoading}
      />

      {!shouldHideButtons && (
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
    </div>
  );
};

export default WorkspaceControl;