"use client";

import { useMemo, useState } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import CreateWorkspaceDialog from "./CreateWorkspaceDialog";
import WorkspaceCombobox, {
  type WorkspaceOption,
} from "./WorkspaceCombobox";
import { useLocation } from "react-router-dom";
import {
  duplicateNamesInList,
  formatScopedResourceLabel,
} from "@/lib/ownerScope";

const WorkspaceControl = () => {
  const {
    currentWorkspace,
    currentWorkspaceOwnerId,
    setCurrentWorkspace,
    workspaceList,
    scopeHydrated,
    refreshWorkspaceList,
  } = useWorkspace();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const location = useLocation();
  const hideButtonsOnPaths = ["/documents", "/knowledge-base", "/chat"];
  const shouldHideButtons = hideButtonsOnPaths.some((path) =>
    location.pathname.startsWith(path)
  );

  const workspaces: WorkspaceOption[] = useMemo(
    () =>
      workspaceList.map((ws) => ({
        name: ws.name,
        owner_id: ws.owner_id,
        owner_username: ws.owner_username,
      })),
    [workspaceList]
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshWorkspaceList();
    } catch (error) {
      console.error("Failed to fetch workspaces:", error);
      toast.error("Failed to load workspaces.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSelect = (ws: WorkspaceOption) => {
    setCurrentWorkspace(ws.name, ws.owner_id ?? null);
    const label = formatScopedResourceLabel(ws.name, ws.owner_username, {
      duplicateNames: duplicateNamesInList(workspaces),
    });
    toast.success(`Switched to workspace: ${label}`);
  };

  const handleWorkspaceCreated = (newWorkspaceName: string) => {
    void refreshWorkspaceList().then((list) => {
      const created = list.find((w) => w.name === newWorkspaceName);
      setCurrentWorkspace(
        newWorkspaceName,
        created?.owner_id ?? null
      );
      toast.success(`Workspace '${newWorkspaceName}' created and selected.`);
    });
  };

  const isLoading = !scopeHydrated || isRefreshing;

  return (
    <div className="flex items-center space-x-2">
      <WorkspaceCombobox
        workspaces={workspaces}
        value={currentWorkspace}
        valueOwnerId={currentWorkspaceOwnerId}
        onSelect={handleSelect}
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
            onClick={() => void handleRefresh()}
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
