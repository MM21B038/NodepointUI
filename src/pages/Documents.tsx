"use client";

import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, Loader2, Trash2, Zap, XCircle } from "lucide-react";
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
import FileUpload from "@/components/FileUpload";
import FileListItem from "@/components/FileListItem";
import DeleteConfirmationDialog from "@/components/DeleteConfirmationDialog";
import PipelineStatusDialog from "@/components/PipelineStatusDialog";
import PreprocessStatusTable from "@/components/PreprocessStatusTable";
import PipelineStatusIndicator from "@/components/PipelineStatusIndicator";
import { getWorkspaces, listFiles, deleteWorkspace, startPreprocess } from "@/database/workspaceStorage";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePipelineStatus } from "@/hooks/usePipelineStatus";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type ViewMode = "files" | "status";

const Documents = () => {
  const [isCreateWorkspaceDialogOpen, setIsCreateWorkspaceDialogOpen] = useState(false);
  const [isOpenWorkspaceDialogOpen, setIsOpenWorkspaceDialogOpen] = useState(false);
  const [isDeleteWorkspaceDialogOpen, setIsDeleteWorkspaceDialogOpen] = useState(false);
  const [isPipelineStatusDialogOpen, setIsPipelineStatusDialogOpen] = useState(false);

  const [existingWorkspaces, setExistingWorkspaces] = useState<string[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isStartingPreprocess, setIsStartingPreprocess] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("files");

  // Hook: it will auto-check when currentWorkspace changes
  const {
    isPipelineRunning,
    pipelineData,
    isLoading: isLoadingPipelineStatus,
    refetch: refetchPipelineStatus,
    forceReset,
  } = usePipelineStatus(currentWorkspace);

  // Ensure boolean value
  const isProcessing = Boolean(isStartingPreprocess) || Boolean(isPipelineRunning);

  // ---- Debug: visible state panel on the page + console logs ----
  useEffect(() => {
    console.log("[Docs] currentWorkspace:", currentWorkspace);
    console.log("[Docs] existingWorkspaces:", existingWorkspaces);
    console.log("[Docs] isStartingPreprocess:", isStartingPreprocess);
    console.log("[Docs] isPipelineRunning:", isPipelineRunning);
    console.log("[Docs] isProcessing:", isProcessing);
    console.log("[Docs] isLoadingWorkspaces:", isLoadingWorkspaces);
    console.log("[Docs] pipelineData:", pipelineData);
  }, [currentWorkspace, existingWorkspaces, isStartingPreprocess, isPipelineRunning, isProcessing, isLoadingWorkspaces, pipelineData]);
  // ---------------------------------------------------------------

  const fetchFiles = useCallback(async (workspaceName: string) => {
    setIsLoadingFiles(true);
    try {
      const loadedFiles = await listFiles(workspaceName);
      setFiles(loadedFiles);
    } catch (error) {
      toast.error(`Failed to load files for ${workspaceName}.`);
      setFiles([]);
    } finally {
      setIsLoadingFiles(false);
    }
  }, []);

  /**
   * Fetch workspaces and set currentWorkspace safely using functional update to avoid stale closures.
   * This will:
   *  - set existingWorkspaces
   *  - if currentWorkspace is null or not present in the returned list, pick the first workspace
   */
  const fetchWorkspaces = useCallback(async () => {
    setIsLoadingWorkspaces(true);
    try {
      const loadedWorkspaces = await getWorkspaces();
      setExistingWorkspaces(loadedWorkspaces);

      // Safely update currentWorkspace using the latest previous value
      setCurrentWorkspace((prev) => {
        if (loadedWorkspaces.length === 0) {
          return null;
        }
        if (prev && loadedWorkspaces.includes(prev)) {
          return prev; // keep existing selection
        }
        // otherwise pick the first workspace
        return loadedWorkspaces[0];
      });

      return loadedWorkspaces;
    } catch (error) {
      toast.error("Failed to load workspaces from the API.");
      console.error("fetchWorkspaces error:", error);
      return null;
    } finally {
      setIsLoadingWorkspaces(false);
    }
  }, []);

  // Load existing workspaces on mount
  useEffect(() => {
    void fetchWorkspaces();
  }, [fetchWorkspaces]);

  // Whenever currentWorkspace becomes set, load its files and trigger a status fetch.
  useEffect(() => {
    if (!currentWorkspace) {
      setFiles([]);
      return;
    }

    // load files for the workspace
    void (async () => {
      await fetchFiles(currentWorkspace);
      // Make sure we fetch pipeline status for the exact workspace (avoid stale closure)
      await refetchPipelineStatus(currentWorkspace);
    })();
  }, [currentWorkspace, fetchFiles, refetchPipelineStatus]);

  const handleRefresh = async () => {
    const loaded = await fetchWorkspaces();
    if (loaded) toast.info("Workspaces refreshed from API.");

    // Explicitly refetch status if we have a selected workspace after refresh
    if (currentWorkspace) {
      void refetchPipelineStatus(currentWorkspace);
    }
  };

  const handleCreateWorkspace = (name: string) => {
    // re-fetch list; setCurrentWorkspace will keep or pick first
    void fetchWorkspaces();
    setCurrentWorkspace(name);
    toast.success(`Workspace "${name}" created and opened.`);
  };

  const handleSelectWorkspace = (workspaceName: string) => {
    toast.success(`Selected workspace: ${workspaceName}`);
    setCurrentWorkspace(workspaceName);
    setIsOpenWorkspaceDialogOpen(false);
  };

  const handleUploadSuccess = () => {
    if (currentWorkspace) {
      void fetchFiles(currentWorkspace);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!currentWorkspace) return;

    const workspaceToDelete = currentWorkspace;
    const loadingToastId = toast.loading(`Deleting workspace ${workspaceToDelete}...`);

    try {
      await deleteWorkspace(workspaceToDelete);
      toast.success(`Workspace "${workspaceToDelete}" deleted successfully.`, { id: loadingToastId });
      // re-fetch and clear selection
      setCurrentWorkspace(null);
      void fetchWorkspaces();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error during deletion.";
      toast.error(`Deletion failed: ${errorMessage}`, { id: loadingToastId });
    } finally {
      setIsDeleteWorkspaceDialogOpen(false);
    }
  };

  const handleStartPreprocess = async () => {
    if (!currentWorkspace) {
      toast.error("Please select a workspace first.");
      return;
    }

    setIsStartingPreprocess(true);
    const loadingToastId = toast.loading(`Starting preprocessing for ${currentWorkspace}...`);

    try {
      const result = await startPreprocess(currentWorkspace);
      toast.success(result.message, { id: loadingToastId });

      // Immediately refetch to pick up queue/running status (pass override to avoid stale closure).
      await refetchPipelineStatus(currentWorkspace);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error during preprocessing.";
      toast.error(`Preprocessing failed: ${errorMessage}`, { id: loadingToastId });
      if (currentWorkspace) {
        await refetchPipelineStatus(currentWorkspace);
      }
    } finally {
      setIsStartingPreprocess(false);
    }
  };

  const handleOpenPipelineStatus = () => {
    setIsPipelineStatusDialogOpen(true);
  };

  const handleClearPipelineStatus = () => {
    if (!currentWorkspace) return;
    forceReset();
    toast.info("Pipeline status reset initiated. Checking API for current status...");
  };

  const getDisabledTooltipMessage = () => {
    if (!currentWorkspace) {
      return "Please select a workspace first.";
    }
    if (isStartingPreprocess) {
      return "Starting preprocessing...";
    }
    if (isPipelineRunning) {
      return "Pipeline is currently running or queued. Check status for details.";
    }
    return "";
  };

  const renderStartPreprocessButton = () => {
    const tooltipMessage = getDisabledTooltipMessage();

    const button = (
      <Button
        type="button"
        variant="default"
        onClick={handleStartPreprocess}
        disabled={!currentWorkspace || isProcessing}
        className="flex items-center space-x-1"
      >
        {isStartingPreprocess ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
        <span>Start Preprocess</span>
      </Button>
    );

    if (isProcessing || !currentWorkspace) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div>{button}</div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltipMessage}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return button;
  };

  return (
    <div className="space-y-6">
      {/* DEBUG PANEL - remove when done */}
      <div className="p-3 rounded-md border bg-muted/5 text-sm">
        <strong>Debug panel (temporary)</strong>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="font-medium">existingWorkspaces</div>
            <pre className="whitespace-pre-wrap">{JSON.stringify(existingWorkspaces, null, 2)}</pre>
          </div>
          <div>
            <div className="font-medium">currentWorkspace</div>
            <div>{String(currentWorkspace)}</div>
            <div className="font-medium mt-2">isProcessing</div>
            <div>{String(isProcessing)}</div>
            <div className="font-medium mt-2">isLoadingWorkspaces</div>
            <div>{String(isLoadingWorkspaces)}</div>
          </div>
          <div className="col-span-2">
            <div className="font-medium mt-2">pipelineData</div>
            <pre className="whitespace-pre-wrap max-h-40 overflow-auto">{JSON.stringify(pipelineData, null, 2)}</pre>
          </div>
        </div>
      </div>
      {/* END DEBUG PANEL */}

      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <h2 className="text-3xl font-semibold">Workspace {currentWorkspace && `(${currentWorkspace})`}</h2>
          {currentWorkspace && (
            <PipelineStatusIndicator isPipelineRunning={isPipelineRunning} onClick={handleOpenPipelineStatus} />
          )}
        </div>

        <div className="flex items-center space-x-4">
          <FileUpload workspaceName={currentWorkspace} onUploadSuccess={handleUploadSuccess} />

          {/* TEMP: native button to isolate UI lib vs upstream */}
          <div>
            <button
              type="button"
              onClick={handleStartPreprocess}
              disabled={!currentWorkspace || isProcessing}
              className={`inline-flex items-center space-x-1 px-3 py-1 rounded-md border ${
                (!currentWorkspace || isProcessing) ? "opacity-60 cursor-not-allowed" : "bg-primary text-primary-foreground"
              }`}
            >
              {isStartingPreprocess ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              <span>Start Preprocess (native)</span>
            </button>
          </div>

          {/* Keep original, but hidden on small screens so the native button is the easy target */}
          <div className="hidden md:block">{renderStartPreprocessButton()}</div>

          <Button type="button" variant="outline" size="icon" onClick={handleRefresh} disabled={isLoadingWorkspaces}>
            <RefreshCw className={isLoadingWorkspaces ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" disabled={isLoadingWorkspaces}>
                Workspace
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsCreateWorkspaceDialogOpen(true)}>+ Create New</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsOpenWorkspaceDialogOpen(true)}>Open Existing</DropdownMenuItem>

              {currentWorkspace && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsDeleteWorkspaceDialogOpen(true)} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" /> Delete Current Workspace
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={handleClearPipelineStatus} disabled={!isPipelineRunning}>
                    <XCircle className="h-4 w-4 mr-2" /> Clear Pipeline Status
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* View toggle & content */}
      {currentWorkspace && (
        <div className="flex justify-end">
          <ToggleGroup type="single" value={viewMode} onValueChange={(value: ViewMode) => value && setViewMode(value)} className="border rounded-md">
            <ToggleGroupItem value="files" aria-label="Toggle files view">
              Files
            </ToggleGroupItem>
            <ToggleGroupItem value="status" aria-label="Toggle status view">
              Status Page
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}

      <div className="border rounded-lg p-6 bg-card text-card-foreground min-h-[300px]">
        {isLoadingWorkspaces ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Loading workspaces...</p>
          </div>
        ) : currentWorkspace ? (
          viewMode === "files" ? (
            <div className="space-y-4">
              <h3 className="text-xl font-medium border-b pb-2">Files in {currentWorkspace}</h3>
              {isLoadingFiles ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : files.length > 0 ? (
                <ScrollArea className="h-64">
                  <ul className="space-y-2">
                    {files.map((file) => (
                      <FileListItem
                        key={file}
                        fileName={file}
                        workspaceName={currentWorkspace}
                        onDeleteSuccess={() => fetchFiles(currentWorkspace)}
                      />
                    ))}
                  </ul>
                </ScrollArea>
              ) : (
                <div className="flex items-center justify-center h-48">
                  <p className="text-muted-foreground">No documents found in this workspace. Upload one to get started!</p>
                </div>
              )}
            </div>
          ) : (
            <PreprocessStatusTable workspaceName={currentWorkspace} />
          )
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Please create or open a workspace to view documents.</p>
          </div>
        )}
      </div>

      <CreateWorkspaceDialog isOpen={isCreateWorkspaceDialogOpen} onClose={() => setIsCreateWorkspaceDialogOpen(false)} onCreate={handleCreateWorkspace} />

      <OpenWorkspaceDialog isOpen={isOpenWorkspaceDialogOpen} onClose={() => setIsOpenWorkspaceDialogOpen(false)} existingWorkspaces={existingWorkspaces} onSelect={handleSelectWorkspace} currentWorkspace={currentWorkspace} />

      {currentWorkspace && (
        <>
          <DeleteConfirmationDialog isOpen={isDeleteWorkspaceDialogOpen} onClose={() => setIsDeleteWorkspaceDialogOpen(false)} onConfirm={handleDeleteWorkspace} title={`Delete Workspace: ${currentWorkspace}`} description={`This action will permanently delete the entire workspace "${currentWorkspace}" and all its associated files. This action cannot be undone.`} itemName={currentWorkspace} />
          <PipelineStatusDialog isOpen={isPipelineStatusDialogOpen} onClose={() => { setIsPipelineStatusDialogOpen(false); if (currentWorkspace) void refetchPipelineStatus(currentWorkspace); }} data={pipelineData} isLoading={isLoadingPipelineStatus} />
        </>
      )}
    </div>
  );
};

export default Documents;
