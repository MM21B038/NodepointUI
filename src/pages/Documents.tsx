"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useWorkspace } from "@/context/WorkspaceContext";
import {
  deleteFile,
  getKnowledgeGraph,
  getPerFileGraphCounts,
  listFiles,
  startPreprocess,
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
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);

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
    setFileToDelete(fileName);
    setIsDeleteDialogOpen(true);
  };

  const executeDeleteFile = async () => {
    if (!currentWorkspace || !fileToDelete) return;

    setIsDeleting(true);
    const deleteToastId = showLoading(`Deleting ${fileToDelete}...`);
    try {
      await deleteFile(currentWorkspace, fileToDelete);
      dismissToast(deleteToastId);
      showSuccess(`${fileToDelete} deleted successfully!`);
      fetchKnowledgeGraphData(currentWorkspace);
      setPreprocessRefreshToken((t) => t + 1);
    } catch (error: unknown) {
      dismissToast(deleteToastId);
      const message = error instanceof Error ? error.message : "Delete failed";
      showError(`Failed to delete file: ${message}`);
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setFileToDelete(null);
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
      await startPreprocess(currentWorkspace);
      dismissToast(preprocessToastId);
      showSuccess(`Preprocessing started for ${currentWorkspace}`);
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
              isDeleting={isDeleting}
              onUploadSuccess={handleUploadSuccess}
              onStartPreprocess={handleStartPreprocess}
              isPreprocessing={isPreprocessing}
            />
          </CardContent>
        </Card>
      )}

      {fileToDelete && (
        <DeleteConfirmationDialog
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          onConfirm={executeDeleteFile}
          title={`Permanently Delete File: ${fileToDelete}`}
          description={`This action will permanently delete the file "${fileToDelete}" from workspace "${currentWorkspace}". This action cannot be undone.`}
          itemName={fileToDelete}
        />
      )}
    </div>
  );
};

export default Documents;
