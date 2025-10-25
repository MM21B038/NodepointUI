"use client";

import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, Loader2, Trash2, Zap } from "lucide-react";
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

type ViewMode = 'files' | 'status';

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
  const [viewMode, setViewMode] = useState<ViewMode>('files');

  // Hook call is unconditional
  const { isPipelineRunning, pipelineData, refetch: refetchPipelineStatus, startPolling } = usePipelineStatus(currentWorkspace);
  
  // Determine if the button should be disabled and blinking
  const isProcessing = isStartingPreprocess || isPipelineRunning;

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

  const fetchWorkspaces = useCallback(async () => {
    setIsLoadingWorkspaces(true);
    try {
      const loadedWorkspaces = await getWorkspaces();
      setExistingWorkspaces(loadedWorkspaces);
      
      let newCurrentWorkspace = currentWorkspace;

      // Determine the new current workspace
      if (loadedWorkspaces.length > 0) {
        if (currentWorkspace === null || !loadedWorkspaces.includes(currentWorkspace)) {
          newCurrentWorkspace = loadedWorkspaces[0];
        }
      } else {
        newCurrentWorkspace = null;
      }
      
      setCurrentWorkspace(newCurrentWorkspace);
      
      // If a workspace is selected, fetch its files
      if (newCurrentWorkspace) {
        await fetchFiles(newCurrentWorkspace);
      } else {
        setFiles([]);
      }
      
      return true;
    } catch (error) {
      toast.error("Failed to load workspaces from the API.");
      console.error(error);
      return false;
    } finally {
      setIsLoadingWorkspaces(false);
    }
  }, [currentWorkspace, fetchFiles]);

  // Load existing workspaces on mount
  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  // Refetch files whenever currentWorkspace changes
  useEffect(() => {
    if (currentWorkspace) {
      fetchFiles(currentWorkspace);
    } else {
      setFiles([]);
    }
  }, [currentWorkspace, fetchFiles]);

  // Refetch pipeline status when opening the dialog
  useEffect(() => {
    if (isPipelineStatusDialogOpen) {
      refetchPipelineStatus();
    }
  }, [isPipelineStatusDialogOpen, refetchPipelineStatus]);


  const handleRefresh = async () => {
    const success = await fetchWorkspaces();
    if (success) {
      toast.info("Workspaces refreshed from API.");
    }
  };

  const handleCreateWorkspace = (name: string) => {
    fetchWorkspaces();
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
      fetchFiles(currentWorkspace);
    }
  };
  
  const handleDeleteWorkspace = async () => {
    if (!currentWorkspace) return;

    const workspaceToDelete = currentWorkspace;
    const loadingToastId = toast.loading(`Deleting workspace ${workspaceToDelete}...`);

    try {
      await deleteWorkspace(workspaceToDelete);
      toast.success(`Workspace "${workspaceToDelete}" deleted successfully.`, { id: loadingToastId });
      
      setCurrentWorkspace(null);
      fetchWorkspaces();
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
      
      // Backend now returns immediately, so we show success and immediately start polling
      toast.success(result.message, { id: loadingToastId });
      startPolling(); // Start polling immediately to track progress
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error during preprocessing.";
      toast.error(`Preprocessing failed: ${errorMessage}`, { id: loadingToastId });
    } finally {
      setIsStartingPreprocess(false);
      // Note: isPipelineRunning will now control the button state via isProcessing
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <h2 className="text-3xl font-semibold">
            Workspace {currentWorkspace && `(${currentWorkspace})`}
          </h2>
          {/* Display the status indicator if a workspace is selected */}
          {currentWorkspace && (
            <PipelineStatusIndicator
              isPipelineRunning={isPipelineRunning}
              onClick={() => setIsPipelineStatusDialogOpen(true)}
            />
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          <FileUpload 
            workspaceName={currentWorkspace} 
            onUploadSuccess={handleUploadSuccess} 
          />
          <Button
            variant="default"
            onClick={handleStartPreprocess}
            disabled={!currentWorkspace || isProcessing}
            className={cn(
              "flex items-center space-x-1",
              isProcessing && "bg-yellow-500 hover:bg-yellow-600 text-black animate-yellow-blink"
            )}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            <span>Start Preprocess</span>
          </Button>
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoadingWorkspaces}>
            <RefreshCw className={isLoadingWorkspaces ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isLoadingWorkspaces}>Workspace</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsCreateWorkspaceDialogOpen(true)}>
                + Create New
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsOpenWorkspaceDialogOpen(true)}>
                Open Existing
              </DropdownMenuItem>
              
              {currentWorkspace && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => setIsDeleteWorkspaceDialogOpen(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Current Workspace
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* View Toggle */}
      {currentWorkspace && (
        <div className="flex justify-end">
          <ToggleGroup 
            type="single" 
            value={viewMode} 
            onValueChange={(value: ViewMode) => value && setViewMode(value)}
            className="border rounded-md"
          >
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
          viewMode === 'files' ? (
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
                  <p className="text-muted-foreground">
                    No documents found in this workspace. Upload one to get started!
                  </p>
                </div>
              )}
            </div>
          ) : (
            <PreprocessStatusTable workspaceName={currentWorkspace} />
          )
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">
              Please create or open a workspace to view documents.
            </p>
          </div>
        )}
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
      
      {currentWorkspace && (
        <>
          <DeleteConfirmationDialog
            isOpen={isDeleteWorkspaceDialogOpen}
            onClose={() => setIsDeleteWorkspaceDialogOpen(false)}
            onConfirm={handleDeleteWorkspace}
            title={`Delete Workspace: ${currentWorkspace}`}
            description={`This action will permanently delete the entire workspace "${currentWorkspace}" and all its associated files. This action cannot be undone.`}
            itemName={currentWorkspace}
          />
          <PipelineStatusDialog
            isOpen={isPipelineStatusDialogOpen}
            onClose={() => setIsPipelineStatusDialogOpen(false)}
            data={pipelineData}
          />
        </>
      )}
    </div>
  );
};

export default Documents;