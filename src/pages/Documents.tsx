"use client";

import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import CreateWorkspaceDialog from "@/components/CreateWorkspaceDialog";
import OpenWorkspaceDialog from "@/components/OpenWorkspaceDialog";
import FileUpload from "@/components/FileUpload";
import { getWorkspaces, listFiles } from "@/database/workspaceStorage";
import { ScrollArea } from "@/components/ui/scroll-area";

const Documents = () => {
  const [isCreateWorkspaceDialogOpen, setIsCreateWorkspaceDialogOpen] = useState(false);
  const [isOpenWorkspaceDialogOpen, setIsOpenWorkspaceDialogOpen] = useState(false);
  const [existingWorkspaces, setExistingWorkspaces] = useState<string[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

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


  const handleRefresh = async () => {
    const success = await fetchWorkspaces();
    if (success) {
      toast.info("Workspaces refreshed from API.");
    }
  };

  const handleCreateWorkspace = (name: string) => {
    // After successful creation via API (handled in dialog), refresh the list
    fetchWorkspaces();
    setCurrentWorkspace(name); 
    toast.success(`Workspace "${name}" created and opened.`);
  };

  const handleSelectWorkspace = (workspaceName: string) => {
    toast.success(`Selected workspace: ${workspaceName}`);
    setCurrentWorkspace(workspaceName);
    setIsOpenWorkspaceDialogOpen(false); // Close dialog after selection
  };

  const handleUploadSuccess = () => {
    if (currentWorkspace) {
      fetchFiles(currentWorkspace); // Refresh file list after successful upload
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
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="border rounded-lg p-6 bg-card text-card-foreground min-h-[300px]">
        {isLoadingWorkspaces ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Loading workspaces...</p>
          </div>
        ) : currentWorkspace ? (
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
                    <li key={file} className="flex items-center p-2 border rounded-md bg-secondary/50">
                      <FileText className="h-4 w-4 mr-3 text-primary" />
                      <span>{file}</span>
                    </li>
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
    </div>
  );
};

export default Documents;