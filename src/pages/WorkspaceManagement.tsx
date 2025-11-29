"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FolderCog, Info, Loader2, Plus, Search } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import { useWorkspace } from "@/context/WorkspaceContext";
import { getWorkspaces, createWorkspace, deleteWorkspace } from "@/database/workspaceStorage";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import DeleteConfirmationDialog from "@/components/DeleteConfirmationDialog";
import WorkspaceCard from "@/components/WorkspaceCard";

const WorkspaceManagement = () => {
  const { currentWorkspace, setCurrentWorkspace } = useWorkspace();
  const [allWorkspaces, setAllWorkspaces] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchWorkspaces = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await getWorkspaces();
      list.sort((a, b) => b.localeCompare(a));
      setAllWorkspaces(list);

      if (currentWorkspace && !list.includes(currentWorkspace)) {
        setCurrentWorkspace(null);
      }
      if (!currentWorkspace && list.length > 0) {
        setCurrentWorkspace(list[0]);
      } else if (list.length === 0) {
        setCurrentWorkspace(null);
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

  const handleCreateWorkspace = async () => {
    const name = newWorkspaceName.trim();
    if (!name) {
      toast.error("Workspace name cannot be empty.");
      return;
    }

    setIsCreating(true);
    const loadingToastId = toast.loading(`Creating workspace "${name}"...`);

    try {
      const success = await createWorkspace(name);
      if (success) {
        toast.success(`Workspace "${name}" created successfully!`, { id: loadingToastId });
        setNewWorkspaceName("");
        fetchWorkspaces().then(() => {
          setCurrentWorkspace(name);
        });
      } else {
        toast.error(`Workspace "${name}" already exists. Please choose another name.`, { id: loadingToastId });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      toast.error(`Failed to create workspace: ${errorMessage}`, { id: loadingToastId });
      console.error("Error creating workspace:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectWorkspace = (workspaceName: string) => {
    setCurrentWorkspace(workspaceName);
    toast.success(`Switched to workspace: ${workspaceName}`);
  };

  const handleDeleteClick = (workspaceName: string) => {
    setWorkspaceToDelete(workspaceName);
    setIsDeleteDialogOpen(true);
  };

  const executeDeleteWorkspace = useCallback(async () => {
    if (!workspaceToDelete) return;

    setIsDeleting(true);
    const loadingToastId = toast.loading(`Deleting workspace ${workspaceToDelete}...`);

    try {
      await deleteWorkspace(workspaceToDelete);
      toast.success(`Workspace "${workspaceToDelete}" deleted successfully.`, { id: loadingToastId });
      fetchWorkspaces();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error during deletion.";
      toast.error(`Deletion failed: ${errorMessage}`, { id: loadingToastId });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setWorkspaceToDelete(null);
    }
  }, [workspaceToDelete, fetchWorkspaces]);

  const filteredWorkspaces = useMemo(() => {
    if (!searchTerm) {
      return allWorkspaces;
    }
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return allWorkspaces.filter(workspace =>
      workspace.toLowerCase().includes(lowerCaseSearchTerm)
    );
  }, [allWorkspaces, searchTerm]);

  return (
    <div className="flex-grow h-full p-4 bg-gradient-to-br from-background to-muted/20">
      <ResizablePanelGroup
        direction="horizontal"
        className="min-h-[calc(100vh - var(--navbar-height) - var(--footer-height) - 32px)] rounded-xl border shadow-lg bg-card"
      >
        {/* Left Panel: Create and Search */}
        <ResizablePanel defaultSize={25} minSize={20} maxSize={35} className="p-4 flex flex-col space-y-6"> {/* Reduced padding and space-y */}
          {/* Create Workspace Section */}
          <Card className="flex-shrink-0">
            <CardHeader className="pb-3"> {/* Reduced padding */}
              <CardTitle className="flex items-center text-xl">
                <Plus className="h-5 w-5 mr-2 text-primary" /> Create New Workspace
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3"> {/* Reduced padding and space-y */}
              <div>
                <Label htmlFor="new-workspace-name" className="sr-only">Workspace Name</Label>
                <Input
                  id="new-workspace-name"
                  placeholder="Enter new workspace name"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  disabled={isCreating}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateWorkspace();
                    }
                  }}
                />
              </div>
              <Button
                onClick={handleCreateWorkspace}
                disabled={isCreating || !newWorkspaceName.trim()}
                className="w-full"
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Create
              </Button>
            </CardContent>
          </Card>

          <Separator />

          {/* Search Workspaces Section */}
          <Card className="flex-shrink-0">
            <CardHeader className="pb-3"> {/* Reduced padding */}
              <CardTitle className="flex items-center text-xl">
                <Search className="h-5 w-5 mr-2 text-primary" /> Search Workspaces
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3"> {/* Reduced padding and space-y */}
              <Label htmlFor="search-workspace" className="sr-only">Search</Label>
              <Input
                id="search-workspace"
                placeholder="Search by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </CardContent>
          </Card>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel: Workspace List */}
        <ResizablePanel defaultSize={75} className="p-4"> {/* Reduced padding */}
          {isLoading ? (
            <div className="flex-grow flex flex-col items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="mt-4 text-lg text-muted-foreground">Loading workspaces...</span>
            </div>
          ) : allWorkspaces.length === 0 ? (
            <div className="flex-grow flex flex-col items-center justify-center h-full text-center">
              <Alert className="max-w-lg">
                <Info className="h-4 w-4" />
                <AlertTitle>No Workspaces Found</AlertTitle>
                <AlertDescription>
                  It looks like you don't have any workspaces yet. Use the "Create New Workspace" panel to get started!
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <ScrollArea className="h-full w-full pr-4 hide-scrollbar">
              {filteredWorkspaces.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-lg">
                  <p>No workspaces match your search term.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"> {/* Reduced gap */}
                  {filteredWorkspaces.map((workspace) => (
                    <WorkspaceCard
                      key={workspace}
                      workspaceName={workspace}
                      isCurrent={currentWorkspace === workspace}
                      onSelect={handleSelectWorkspace}
                      onDelete={handleDeleteClick}
                      isDeleting={isDeleting}
                      deletingWorkspaceName={workspaceToDelete}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>

      {workspaceToDelete && (
        <DeleteConfirmationDialog
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          onConfirm={executeDeleteWorkspace}
          title={`Permanently Delete Workspace: ${workspaceToDelete}`}
          description={`This action will permanently delete the workspace "${workspaceToDelete}" and all associated documents and data. This action cannot be undone.`}
          itemName={workspaceToDelete}
        />
      )}
    </div>
  );
};

export default WorkspaceManagement;