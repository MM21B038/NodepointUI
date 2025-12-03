"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FolderCog, Info, Loader2, Plus, Search, ChevronLeft, ChevronRight, Flag } from "lucide-react"; // Added Flag icon
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
import { getWorkspaces, createWorkspace, deleteWorkspace, listFiles, getKnowledgeGraph, WorkspaceEntry, startPreprocess, getFlagStatus } from "@/database/workspaceStorage"; // Import WorkspaceEntry and startPreprocess, getFlagStatus
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import DeleteConfirmationDialog from "@/components/DeleteConfirmationDialog";
import WorkspaceCard from "@/components/WorkspaceCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Import Select components

const WorkspacesPerPage = 8; // Changed to 8 workspaces per page

const WorkspaceManagement = () => {
  const { currentWorkspace, setCurrentWorkspace } = useWorkspace();
  const [allWorkspaces, setAllWorkspaces] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [flagFilter, setFlagFilter] = useState<"both" | "flagged" | "unflagged">("both"); // New state for flag filter
  const [workspaceFlagStatus, setWorkspaceFlagStatus] = useState<Map<string, boolean>>(new Map()); // New state for flag statuses

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExtractingMap, setIsExtractingMap] = useState<Map<string, boolean>>(new Map()); // New state for extraction loading

  const [currentPage, setCurrentPage] = useState(0);

  // State for cached workspace statistics and their loading status
  const [cachedWorkspaceStats, setCachedWorkspaceStats] = useState<Map<string, { files: number; nodes: number; edges: number }>>(new Map());
  const [statsLoadingMap, setStatsLoadingMap] = useState<Map<string, boolean>>(new Map());

  // Function to fetch and cache stats for a single workspace
  const fetchAndCacheStatsForWorkspace = useCallback(async (workspaceName: string) => {
    // If already cached or currently loading, do nothing
    if (cachedWorkspaceStats.has(workspaceName) || statsLoadingMap.get(workspaceName)) {
      return;
    }

    setStatsLoadingMap(prev => new Map(prev).set(workspaceName, true));

    try {
      const files = await listFiles(workspaceName);
      const graph = await getKnowledgeGraph(workspaceName);
      setCachedWorkspaceStats(prev => new Map(prev).set(workspaceName, {
        files: files.length,
        nodes: graph.nodes?.length || 0,
        edges: graph.edges?.length || 0,
      }));
    } catch (error) {
      console.error(`Failed to fetch stats for workspace ${workspaceName}:`, error);
      setCachedWorkspaceStats(prev => new Map(prev).set(workspaceName, { files: 0, nodes: 0, edges: 0 })); // Store default on error
    } finally {
      setStatsLoadingMap(prev => new Map(prev).set(workspaceName, false));
    }
  }, [cachedWorkspaceStats, statsLoadingMap]); // Dependencies for useCallback

  const fetchWorkspaces = useCallback(async () => {
    setIsLoading(true);
    try {
      const list: WorkspaceEntry[] = await getWorkspaces();
      
      // Sort by timestamp in descending order (latest first)
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      const workspaceNames = list.map(ws => ws.workspace_name);
      setAllWorkspaces(workspaceNames);

      // Fetch flag status for all workspaces in parallel
      const flagStatusPromises = workspaceNames.map(async (name) => {
        try {
          const status = await getFlagStatus(name);
          return { name, isFlagged: status.flag };
        } catch (error) {
          console.error(`Failed to fetch flag status for ${name}:`, error);
          return { name, isFlagged: false }; // Default to unflagged on error
        }
      });
      const statuses = await Promise.all(flagStatusPromises);
      const newFlagStatusMap = new Map<string, boolean>();
      statuses.forEach(s => newFlagStatusMap.set(s.name, s.isFlagged));
      setWorkspaceFlagStatus(newFlagStatusMap);

      // Update current workspace if it's no longer in the list or set a default
      if (currentWorkspace && !workspaceNames.includes(currentWorkspace)) {
        setCurrentWorkspace(null);
      }
      if (!currentWorkspace && workspaceNames.length > 0) {
        setCurrentWorkspace(workspaceNames[0]);
      } else if (workspaceNames.length === 0) {
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

  // Effect to load stats for visible and next page workspaces
  useEffect(() => {
    if (!currentWorkspace && allWorkspaces.length === 0) return;

    // Recompute filteredWorkspaces here
    const currentFilteredWorkspaces = searchTerm
      ? allWorkspaces.filter(workspace =>
          workspace.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : allWorkspaces;

    const workspacesToLoad: string[] = [];
    const currentWorkspaces = currentFilteredWorkspaces.slice(currentPage * WorkspacesPerPage, (currentPage + 1) * WorkspacesPerPage);
    const nextWorkspaces = currentFilteredWorkspaces.slice((currentPage + 1) * WorkspacesPerPage, (currentPage + 2) * WorkspacesPerPage);

    currentWorkspaces.forEach(ws => workspacesToLoad.push(ws));
    nextWorkspaces.forEach(ws => workspacesToLoad.push(ws));

    // Filter out duplicates and already cached/loading ones
    const uniqueWorkspacesToLoad = Array.from(new Set(workspacesToLoad)).filter(ws =>
        !cachedWorkspaceStats.has(ws) && !statsLoadingMap.get(ws)
    );

    uniqueWorkspacesToLoad.forEach(ws => fetchAndCacheStatsForWorkspace(ws));

  }, [currentPage, currentWorkspace, fetchAndCacheStatsForWorkspace, cachedWorkspaceStats, statsLoadingMap, allWorkspaces, searchTerm]);


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
      // Remove from cache and loading map
      setCachedWorkspaceStats(prev => {
        const newMap = new Map(prev);
        newMap.delete(workspaceToDelete);
        return newMap;
      });
      setStatsLoadingMap(prev => {
        const newMap = new Map(prev);
        newMap.delete(workspaceToDelete);
        return newMap;
      });
      fetchWorkspaces(); // Re-fetch workspace names to update the list
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error during deletion.";
      toast.error(`Deletion failed: ${errorMessage}`, { id: loadingToastId });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setWorkspaceToDelete(null);
    }
  }, [workspaceToDelete, fetchWorkspaces]);

  const handleExtract = useCallback(async (workspaceName: string) => {
    setIsExtractingMap(prev => new Map(prev).set(workspaceName, true));
    const loadingToastId = toast.loading(`Starting extraction for workspace "${workspaceName}"...`);

    try {
      await startPreprocess(workspaceName);
      toast.success(`Extraction started for "${workspaceName}"!`, { id: loadingToastId });
      // Invalidate cache for this workspace and refetch stats
      setCachedWorkspaceStats(prev => {
        const newMap = new Map(prev);
        newMap.delete(workspaceName);
        return newMap;
      });
      // Trigger a re-fetch of stats for this specific workspace
      fetchAndCacheStatsForWorkspace(workspaceName);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      toast.error(`Failed to start extraction: ${errorMessage}`, { id: loadingToastId });
      console.error("Extraction error:", error);
    } finally {
      setIsExtractingMap(prev => new Map(prev).set(workspaceName, false));
    }
  }, [fetchAndCacheStatsForWorkspace]);

  const filteredWorkspaces = useMemo(() => {
    let tempWorkspaces = allWorkspaces;

    // Apply search term filter
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      tempWorkspaces = tempWorkspaces.filter(workspace =>
        workspace.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

    // Apply flag filter
    if (flagFilter !== "both") {
      tempWorkspaces = tempWorkspaces.filter(workspace => {
        const isFlagged = workspaceFlagStatus.get(workspace) || false; // Default to false if status not found
        return flagFilter === "flagged" ? isFlagged : !isFlagged;
      });
    }
    return tempWorkspaces;
  }, [allWorkspaces, searchTerm, flagFilter, workspaceFlagStatus]);

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

          {/* Filter by Flag Status Section */}
          <div className="space-y-3">
            <Label htmlFor="flag-filter" className="text-sm font-medium flex items-center">
                <Flag className="h-4 w-4 mr-2 text-muted-foreground" /> Filter by Flag Status
            </Label>
            <Select value={flagFilter} onValueChange={(value: "both" | "flagged" | "unflagged") => setFlagFilter(value)}>
                <SelectTrigger id="flag-filter" className="w-full">
                    <SelectValue placeholder="Filter by flag status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="both">All Workspaces</SelectItem>
                    <SelectItem value="flagged">Flagged Workspaces</SelectItem>
                    <SelectItem value="unflagged">Unflagged Workspaces</SelectItem>
                </SelectContent>
            </Select>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel: Workspace List with Hover Navigation */}
        <ResizablePanel defaultSize={75} className="p-4 flex flex-col group">
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
                  <p>No workspaces match your current filters.</p>
                </div>
              ) : (
                <div className="relative flex-grow">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 h-full items-stretch">
                    {currentWorkspacesToDisplay.map((workspace) => {
                      const stats = cachedWorkspaceStats.get(workspace) || { files: 0, nodes: 0, edges: 0 };
                      const isLoadingStats = statsLoadingMap.get(workspace) || false;
                      return (
                        <WorkspaceCard
                          key={workspace}
                          workspaceName={workspace}
                          isCurrent={currentWorkspace === workspace}
                          onSelect={handleSelectWorkspace}
                          onDelete={handleDeleteClick}
                          isDeleting={isDeleting}
                          deletingWorkspaceName={workspaceToDelete}
                          totalFiles={stats.files}
                          totalNodes={stats.nodes}
                          totalEdges={stats.edges}
                          isLoadingStats={isLoadingStats}
                          onExtract={handleExtract} // Pass the new handler
                          isExtracting={isExtractingMap.get(workspace) || false} // Pass the extraction status
                        />
                      );
                    })}
                  </div>

                  {/* Left Navigation Overlay */}
                  {totalPages > 1 && currentPage > 0 && (
                    <button
                      onClick={handlePreviousPage}
                      className={cn(
                        "absolute left-0 top-0 bottom-0 w-16 flex items-center justify-center",
                        "bg-gradient-to-r from-background/70 to-transparent",
                        "transition-all duration-300",
                        "z-10 text-foreground hover:text-primary",
                        "opacity-0 pointer-events-none", // Default: hidden and no pointer events
                        "group-hover:opacity-100 group-hover:pointer-events-auto" // On group hover: visible and active pointer events
                      )}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-8 w-8" />
                    </button>
                  )}

                  {/* Right Navigation Overlay */}
                  {totalPages > 1 && currentPage < totalPages - 1 && (
                    <button
                      onClick={handleNextPage}
                      className={cn(
                        "absolute right-0 top-0 bottom-0 w-16 flex items-center justify-center",
                        "bg-gradient-to-l from-background/70 to-transparent",
                        "transition-all duration-300",
                        "z-10 text-foreground hover:text-primary",
                        "opacity-0 pointer-events-none", // Default: hidden and no pointer events
                        "group-hover:opacity-100 group-hover:pointer-events-auto" // On group hover: visible and active pointer events
                      )}
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-8 w-8" />
                    </button>
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