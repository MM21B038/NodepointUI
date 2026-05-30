"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useWorkspace } from "@/context/WorkspaceContext";
import {
  deleteFiles,
  getKnowledgeGraph,
  getPerFileGraphCounts,
  listFiles,
  startPreprocess,
  summarizePreprocessStart,
  type GraphEdge,
  type GraphNode,
} from "@/database/workspaceStorage";
import { Info } from "lucide-react";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import DeleteConfirmationDialog from "@/components/DeleteConfirmationDialog";
import PreprocessStatusTable from "@/components/PreprocessStatusTable";
import type { WorkspacePreprocessStatusResponse } from "@/database/workspaceStorage";

const Documents = () => {
  const { currentWorkspace } = useWorkspace();
  const [preprocessRefreshToken, setPreprocessRefreshToken] = useState(0);
  const wasReadyRef = useRef(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPreprocessing, setIsPreprocessing] = useState(false);
  const [isGraphLoading, setIsGraphLoading] = useState(false);
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([]);
  const [fileGraphData, setFileGraphData] = useState<Record<string, { nodes: number; edges: number }>>({});

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [filesToDelete, setFilesToDelete] = useState<string[]>([]);

  const fetchKnowledgeGraphData = useCallback(async (workspaceName: string, silent = false) => {
    if (!silent) setIsGraphLoading(true);
    try {
      const [graphData, fileNames] = await Promise.all([
        getKnowledgeGraph(workspaceName),
        listFiles(workspaceName),
      ]);

      setGraphNodes(graphData.nodes ?? []);
      setGraphEdges(graphData.edges ?? []);

      const counts = await getPerFileGraphCounts(workspaceName, fileNames);
      setFileGraphData(counts);
    } catch (error) {
      console.error("Failed to fetch knowledge graph:", error);
      setGraphNodes([]);
      setGraphEdges([]);
      setFileGraphData({});
    } finally {
      if (!silent) setIsGraphLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentWorkspace) {
      wasReadyRef.current = true;
      setPreprocessRefreshToken((t) => t + 1);
      fetchKnowledgeGraphData(currentWorkspace);
    } else {
      setGraphNodes([]);
      setGraphEdges([]);
      setFileGraphData({});
    }
  }, [currentWorkspace, fetchKnowledgeGraphData]);

  const confirmDeleteFile = (fileName: string) => {
    setFilesToDelete([fileName]);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteFiles = (fileNames: string[]) => {
    if (fileNames.length === 0) return;
    setFilesToDelete(fileNames);
    setIsDeleteDialogOpen(true);
  };

  const executeDeleteFiles = async () => {
    if (!currentWorkspace || filesToDelete.length === 0) return;

    setIsDeleting(true);
    const deleteToastId = showLoading(
      filesToDelete.length === 1
        ? `Deleting ${filesToDelete[0]}...`
        : `Deleting ${filesToDelete.length} files...`
    );
    try {
      const result = await deleteFiles(currentWorkspace, filesToDelete);
      dismissToast(deleteToastId);
      if (result.failed.length === 0) {
        showSuccess(
          filesToDelete.length === 1
            ? `${filesToDelete[0]} deleted successfully!`
            : `${result.succeeded.length} files deleted successfully!`
        );
      } else if (result.succeeded.length === 0) {
        showError(`Failed to delete files: ${result.failed[0]?.error ?? "Delete failed"}`);
      } else {
        showError(
          `${result.succeeded.length} deleted, ${result.failed.length} failed.`
        );
      }
      if (result.succeeded.length > 0) {
        fetchKnowledgeGraphData(currentWorkspace);
        setPreprocessRefreshToken((t) => t + 1);
      }
    } catch (error: unknown) {
      dismissToast(deleteToastId);
      const message = error instanceof Error ? error.message : "Delete failed";
      showError(`Failed to delete file: ${message}`);
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setFilesToDelete([]);
    }
  };

  const handlePreprocessStatusChange = useCallback(
    (status: WorkspacePreprocessStatusResponse) => {
      if (!currentWorkspace) return;

      if (!status.overall.ready) {
        wasReadyRef.current = false;
        void fetchKnowledgeGraphData(currentWorkspace, true);
      } else if (!wasReadyRef.current) {
        wasReadyRef.current = true;
        void fetchKnowledgeGraphData(currentWorkspace, true);
        showSuccess("Preprocessing complete — workspace is ready for chat and search.");
      }
    },
    [currentWorkspace, fetchKnowledgeGraphData]
  );

  const handleRefreshAll = useCallback(() => {
    if (!currentWorkspace) return;
    fetchKnowledgeGraphData(currentWorkspace);
    setPreprocessRefreshToken((t) => t + 1);
  }, [currentWorkspace, fetchKnowledgeGraphData]);

  const handleStartPreprocess = async () => {
    if (!currentWorkspace) return;

    setIsPreprocessing(true);
    const preprocessToastId = showLoading(`Starting preprocessing for ${currentWorkspace}…`);
    try {
      const result = await startPreprocess(currentWorkspace);
      dismissToast(preprocessToastId);
      showSuccess(summarizePreprocessStart(result));
      wasReadyRef.current = false;
      setPreprocessRefreshToken((t) => t + 1);
      fetchKnowledgeGraphData(currentWorkspace);
    } catch (error: unknown) {
      dismissToast(preprocessToastId);
      const message = error instanceof Error ? error.message : "Preprocess failed";
      showError(`Failed to start preprocessing: ${message}`);
    } finally {
      setIsPreprocessing(false);
    }
  };

  const handleUploadSuccess = useCallback(() => {
    if (!currentWorkspace) return;
    wasReadyRef.current = false;
    handleRefreshAll();
  }, [currentWorkspace, handleRefreshAll]);

  return (
    <div className="flex flex-grow flex-col">
      {!currentWorkspace ? (
        <div className="flex flex-grow items-center justify-center p-4">
          <Alert className="max-w-lg">
            <Info className="h-4 w-4" />
            <AlertTitle>No Workspace Selected</AlertTitle>
            <AlertDescription>
              Please select a workspace using the selector in the navigation bar to view preprocessing
              status.
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <Card className="flex min-h-[80vh] flex-col">
          <CardContent className="flex flex-grow flex-col p-4">
            <PreprocessStatusTable
              workspaceName={currentWorkspace}
              refreshToken={preprocessRefreshToken}
              onStatusChange={handlePreprocessStatusChange}
              onRefreshAll={handleRefreshAll}
              totalNodes={graphNodes.length}
              totalEdges={graphEdges.length}
              fileGraphData={fileGraphData}
              isGraphLoading={isGraphLoading}
              onDeleteFile={confirmDeleteFile}
              onDeleteFiles={confirmDeleteFiles}
              isDeleting={isDeleting}
              onUploadSuccess={handleUploadSuccess}
              onStartPreprocess={handleStartPreprocess}
              isPreprocessing={isPreprocessing}
            />
          </CardContent>
        </Card>
      )}

      {filesToDelete.length > 0 && (
        <DeleteConfirmationDialog
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          onConfirm={executeDeleteFiles}
          title={
            filesToDelete.length === 1
              ? "Permanently Delete File"
              : `Permanently Delete ${filesToDelete.length} Files`
          }
          description={
            filesToDelete.length === 1
              ? `This action will permanently delete the file "${filesToDelete[0]}" from workspace "${currentWorkspace}". This action cannot be undone.`
              : `This action will permanently delete ${filesToDelete.length} files from workspace "${currentWorkspace}". This action cannot be undone.`
          }
          itemName={filesToDelete.length === 1 ? filesToDelete[0] : undefined}
          itemNames={filesToDelete.length > 1 ? filesToDelete : undefined}
        />
      )}
    </div>
  );
};

export default Documents;
