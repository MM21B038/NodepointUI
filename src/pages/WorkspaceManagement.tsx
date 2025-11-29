"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FolderCog, Info, Loader2, Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";
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

const WorkspacesPerPage = 4;

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

  const [currentPage, setCurrentPage] = useState(0); // New state for pagination

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
      setCurrentPage(0); // Reset to first page on refresh
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
      toast.success(`Workspace "${workspaceToDelete}" deleted successfully!`, { id: loadingToastId });
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

  // Pagination logic
  const totalPages = Math.ceil(filteredWorkspaces.length / WorkspacesPerPage);
  const startIndex = currentPage * WorkspacesPerPage;
  const endIndex = startIndex + WorkspacesPerPage;
  const currentWorkspacesToDisplay = filteredWorkspaces.slice(startIndex, endIndex);

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages - 1));
  };

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 0));
  };

  return (
    <div className="flex-grow h-full bg-gradient-to-br from-background to-muted/20">
      <ResizablePanelGroup
        direction="horizontal"
        className="min-h-[calc(100vh - var(--navbar-height) - var(--footer-height))] rounded-xl border shadow-lg bg-card"
      >
        {/* Left Panel: Create and Search */}
        <ResizablePanel defaultSize={25} minSize={20} maxSize={35} className="p-4 flex flex-col space-y-4">
          {/* Create Workspace Section */}
          <div className="space-y-3">
            <h2 className="text-xl font-bold flex items-center text-primary">
              <Plus className="h-5 w-5 mr-2" /> Create New Workspace
            </h2>
            <div className="space-y-2">
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
            </div>
          </div>

          <Separator />

          {/* Search Workspaces Section */}
          <div className="space-y-3">
            <h2 className="text-xl font-bold flex items-center text-primary">
              <Search className="h-5 w-5 mr-2" /> Search Workspaces
            </h2>
            <div className="space-y-2">
              <Label htmlFor="search-workspace" className="sr-only">Search</Label>
              <Input
                id="search-workspace"
                placeholder="Search by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel: Workspace List with Hover Navigation */}
        <ResizablePanel defaultSize={75} className="p-4 flex flex-col group"> {/* Added group class */}
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
            <>
              {filteredWorkspaces.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-lg">
                  <p>No workspaces match your search term.</p>
                </div>
              ) : (
                <div className="relative flex-grow"> {/* New wrapper for grid and overlays */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 h-full items-stretch">
                    {currentWorkspacesToDisplay.map((workspace) => (
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

                  {/* Left Navigation Overlay */}
                  {totalPages > 1 && currentPage > 0 && (
                    <button
                      onClick={handlePreviousPage}
                      className="absolute left-0 top-0 bottom-0 w-16 flex items-center justify-center
                                 bg-gradient-to-r from-background/70 to-transparent
                                 opacity-0 group-hover:opacity-100 transition-opacity duration-300
                                 cursor-pointer z-10 text-foreground hover:text-primary"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-8 w-8" />
                    </button>
                  )}

                  {/* Right Navigation Overlay */}
                  {totalPages > 1 && currentPage < totalPages - 1 && (
                    <button
                      onClick={handleNextPage}
                      className="absolute right-0 top-0 bottom-0 w-16 flex items-center justify-center
                                 bg-gradient-to-l from-background/70 to-transparent
                                 opacity-0 group-hover:opacity-100 transition-opacity duration-300
                                 cursor-pointer z-10 text-foreground hover:text-primary"
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-8 w-8" />
                    </button>
                  )}
                </div>
              )}
              {/* Dynamic Dot Indicators - Moved outside the relative flex-grow div */}
              {totalPages > 1 && (
                <div className="mt-auto py-4 flex justify-center items-center gap-2 z-20">
                  {totalPages === 2 ? (
                    <>
                      {/* Dot for page 0 */}
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full transition-colors cursor-pointer",
                          currentPage === 0 ? "bg-primary" : "bg-muted-foreground/30"
                        )}
                        onClick={() => setCurrentPage(0)}
                        title="Page 1"
                      />
                      {/* Dot for page 1 */}
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full transition-colors cursor-pointer",
                          currentPage === 1 ? "bg-primary" : "bg-muted-foreground/30"
                        )}
                        onClick={() => setCurrentPage(1)}
                        title="Page 2"
                      />
                    </>
                  ) : ( // totalPages >= 3
                    <>
                      {/* Left dot: indicates previous pages */}
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full transition-colors cursor-pointer",
                          currentPage > 0 ? "bg-primary" : "bg-muted-foreground/30"
                        )}
                        onClick={currentPage > 0 ? handlePreviousPage : undefined}
                        title={currentPage > 0 ? "Previous Page" : "No Previous Page"}
                      />
                      {/* Middle dot: always current page */}
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full bg-primary transition-colors"
                        )}
                        title={`Page ${currentPage + 1}`}
                      />
                      {/* Right dot: indicates next pages */}
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full transition-colors cursor-pointer",
                          currentPage < totalPages - 1 ? "bg-primary" : "bg-muted-foreground/30"
                        )}
                        onClick={currentPage < totalPages - 1 ? handleNextPage : undefined}
                        title={currentPage < totalPages - 1 ? "Next Page" : "No Next Page"}
                      />
                    </>
                  )}
                </div>
              )}
            </>
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