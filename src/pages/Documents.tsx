"use client";

import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import FileUpload from "@/components/FileUpload";
import FileListItem from "@/components/FileListItem";
import PreprocessStatusTable from "@/components/PreprocessStatusTable";
import { listFiles, startPreprocess } from "@/database/workspaceStorage";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useWorkspace } from "@/context/WorkspaceContext";

type ViewMode = 'files' | 'status';

const Documents = () => {
  const { currentWorkspace } = useWorkspace();
  
  const [files, setFiles] = useState<string[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isStartingPreprocess, setIsStartingPreprocess] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('files');

  const isProcessing = isStartingPreprocess;

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

  useEffect(() => {
    if (currentWorkspace) {
      fetchFiles(currentWorkspace);
    } else {
      setFiles([]);
    }
  }, [currentWorkspace, fetchFiles]);

  const handleUploadSuccess = () => {
    if (currentWorkspace) {
      fetchFiles(currentWorkspace);
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

      // Backend returns immediately; show success.
      toast.success(result.message, { id: loadingToastId });
      setViewMode('status'); // Switch to status view after starting preprocess

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error during preprocessing.";
      toast.error(`Preprocessing failed: ${errorMessage}`, { id: loadingToastId });
    } finally {
      setIsStartingPreprocess(false);
    }
  };

  const handleRefreshFiles = () => {
    if (currentWorkspace) {
      fetchFiles(currentWorkspace);
      toast.info("File list refreshed.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-semibold">
          Documents {currentWorkspace && `(${currentWorkspace})`}
        </h2>

        <div className="flex items-center space-x-4">
          <FileUpload
            workspaceName={currentWorkspace}
            onUploadSuccess={handleUploadSuccess}
          />

          <Button
            type="button"
            variant="default"
            onClick={handleStartPreprocess}
            disabled={!currentWorkspace || isProcessing}
            className="flex items-center space-x-1"
          >
            {isStartingPreprocess ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            <span>Start Preprocess</span>
          </Button>
        </div>
      </div>

      {currentWorkspace && (
        <div className="flex justify-between items-center">
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
          
          {viewMode === 'files' && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleRefreshFiles}
              disabled={isLoadingFiles}
            >
              <RefreshCw className={isLoadingFiles ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            </Button>
          )}
        </div>
      )}

      <div className="border rounded-lg p-6 bg-card text-card-foreground min-h-[300px]">
        {!currentWorkspace ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">
              Please select a workspace using the selector in the navigation bar.
            </p>
          </div>
        ) : viewMode === 'files' ? (
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
        )}
      </div>
    </div>
  );
};

export default Documents;