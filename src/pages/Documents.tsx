"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useWorkspace } from "@/context/WorkspaceContext";
import {
  listFiles,
  uploadFile,
  deleteFile,
  startPreprocess,
  getPipelineStatus,
  getPreprocessStatus,
  getKnowledgeGraph,
  FilePreprocessStatus,
  ChunkEntry,
  GraphNode,
  GraphEdge,
  FileReference, // Import FileReference for type checking
} from "@/database/workspaceStorage";
import {
  FileStack,
  Upload,
  Trash2,
  Loader2,
  Play,
  RefreshCw,
  Info,
  FileJson,
  FileText,
  FileType,
  File as GenericFile,
  GitGraph,
} from "lucide-react";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import NodeTypeDistributionChart from "@/components/NodeTypeDistributionChart"; // Import new chart
import { ScrollArea } from "@/components/ui/scroll-area"; // Import ScrollArea

// Helper function to get the appropriate icon based on file extension
const getFileIcon = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'json':
      return <FileJson className="h-4 w-4 mr-2 text-blue-500" />;
    case 'md':
    case 'txt':
      return <FileText className="h-4 w-4 mr-2 text-gray-500" />;
    case 'pdf':
      return <FileType className="h-4 w-4 mr-2 text-red-500" />;
    default:
      return <GenericFile className="h-4 w-4 mr-2 text-gray-400" />;
  }
};

const Documents = () => {
  const { currentWorkspace } = useWorkspace();
  const [files, setFiles] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPreprocessing, setIsPreprocessing] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState<ChunkEntry[]>([]);
  const [preprocessStatus, setPreprocessStatus] = useState<FilePreprocessStatus[] | null>(null);
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([]);
  const [isGraphLoading, setIsGraphLoading] = useState(false);
  // New state to store node and edge counts per file
  const [fileGraphData, setFileGraphData] = useState<Record<string, { nodes: number; edges: number }>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async (workspaceName: string) => {
    const fetchedFiles = await listFiles(workspaceName);
    setFiles(fetchedFiles);
  }, []);

  const fetchPipelineAndPreprocessStatus = useCallback(async (workspaceName: string) => {
    const pipeline = await getPipelineStatus(workspaceName);
    setPipelineStatus(pipeline.pipeline || []);

    const preprocess = await getPreprocessStatus(workspaceName);
    setPreprocessStatus(preprocess.files || []);
  }, []);

  const fetchKnowledgeGraphData = useCallback(async (workspaceName: string) => {
    setIsGraphLoading(true);
    try {
      const graphData = await getKnowledgeGraph(workspaceName);
      const nodes = graphData.nodes || [];
      const edges = graphData.edges || [];

      setGraphNodes(nodes);
      setGraphEdges(edges);

      const newFileGraphData: Record<string, { nodes: number; edges: number }> = {};

      // Process nodes to count per file
      nodes.forEach(node => {
        const fileName = typeof node.source === 'object' && node.source !== null && 'file_name' in node.source
          ? (node.source as FileReference).file_name
          : String(node.source);
        if (!newFileGraphData[fileName]) {
          newFileGraphData[fileName] = { nodes: 0, edges: 0 };
        }
        newFileGraphData[fileName].nodes++;
      });

      // Process edges to count per file
      edges.forEach(edge => {
        const fileName = typeof edge.source_file === 'object' && edge.source_file !== null && 'file_name' in edge.source_file
          ? (edge.source_file as FileReference).file_name
          : String(edge.source_file);
        if (!newFileGraphData[fileName]) {
          newFileGraphData[fileName] = { nodes: 0, edges: 0 };
        }
        newFileGraphData[fileName].edges++;
      });

      setFileGraphData(newFileGraphData);

    } catch (error) {
      console.error("Failed to fetch knowledge graph:", error);
      setGraphNodes([]);
      setGraphEdges([]);
      setFileGraphData({}); // Clear file-specific data on error
    } finally {
      setIsGraphLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentWorkspace) {
      fetchFiles(currentWorkspace);
      fetchPipelineAndPreprocessStatus(currentWorkspace);
      fetchKnowledgeGraphData(currentWorkspace);
    } else {
      setFiles([]);
      setPipelineStatus([]);
      setPreprocessStatus(null);
      setGraphNodes([]);
      setGraphEdges([]);
      setFileGraphData({}); // Clear file-specific data on workspace change
    }
  }, [currentWorkspace, fetchFiles, fetchPipelineAndPreprocessStatus, fetchKnowledgeGraphData]);

  const handleUpload = async (fileToUpload: File) => {
    if (!currentWorkspace || !fileToUpload) {
      showError("No file selected for upload or no workspace selected.");
      return;
    }

    const allowedExtensions = ['.json', '.md', '.txt', '.pdf'];
    const fileExtension = `.${fileToUpload.name.split('.').pop()?.toLowerCase()}`;

    if (!allowedExtensions.includes(fileExtension)) {
      showError(`Unsupported file type. Only ${allowedExtensions.join(', ')} files are allowed.`);
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Clear the input
      }
      return;
    }

    setIsUploading(true);
    const uploadToastId = showLoading(`Uploading ${fileToUpload.name}...`);
    try {
      await uploadFile(currentWorkspace, fileToUpload);
      dismissToast(uploadToastId);
      showSuccess(`${fileToUpload.name} uploaded successfully!`);
      fetchFiles(currentWorkspace);
    } catch (error: any) {
      dismissToast(uploadToastId);
      showError(`Failed to upload file: ${error.message}`);
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      handleUpload(event.target.files[0]);
    }
  };

  const handleDeleteFile = async (fileName: string) => {
    if (!currentWorkspace) return;

    setIsDeleting(true);
    const deleteToastId = showLoading(`Deleting ${fileName}...`);
    try {
      await deleteFile(currentWorkspace, fileName);
      dismissToast(deleteToastId);
      showSuccess(`${fileName} deleted successfully!`);
      fetchFiles(currentWorkspace);
      fetchPipelineAndPreprocessStatus(currentWorkspace);
      fetchKnowledgeGraphData(currentWorkspace);
    } catch (error: any) {
      dismissToast(deleteToastId);
      showError(`Failed to delete file: ${error.message}`);
      console.error("Delete error:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStartPreprocess = async () => {
    if (!currentWorkspace) return;

    setIsPreprocessing(true);
    const preprocessToastId = showLoading(`Starting preprocessing for ${currentWorkspace}...`);
    try {
      await startPreprocess(currentWorkspace);
      dismissToast(preprocessToastId);
      showSuccess(`Preprocessing started for ${currentWorkspace}!`);
      fetchPipelineAndPreprocessStatus(currentWorkspace);
    } catch (error: any) {
      dismissToast(preprocessToastId);
      showError(`Failed to start preprocessing: ${error.message}`);
      console.error("Preprocessing error:", error);
    } finally {
      setIsPreprocessing(false);
    }
  };

  const handleRefreshAll = () => {
    if (currentWorkspace) {
      fetchFiles(currentWorkspace);
      fetchPipelineAndPreprocessStatus(currentWorkspace);
      fetchKnowledgeGraphData(currentWorkspace);
      showSuccess("File list and preprocessing status refreshed!");
    } else {
      showError("No workspace selected to refresh.");
    }
  };

  return (
    <div className="flex flex-col flex-grow">
      {!currentWorkspace ? (
        <div className="flex-grow flex items-center justify-center p-4">
          <Alert className="max-w-lg">
            <Info className="h-4 w-4" />
            <AlertTitle>No Workspace Selected</AlertTitle>
            <AlertDescription>
              Please select a workspace using the selector in the navigation bar to manage documents.
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <div className="flex flex-col flex-grow space-y-4 pb-4">
          {/* File Management Card */}
          <Card className="flex flex-col min-h-[80vh]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 border-b">
              <CardTitle className="text-xl font-semibold flex items-center">
                <FileStack className="h-5 w-5 mr-2" /> File Management
              </CardTitle>
              <div className="flex items-center gap-4">
                {/* Display Overall Node and Relationship Counts */}
                <div className="flex items-center text-sm text-muted-foreground">
                  <GitGraph className="h-4 w-4 mr-1" />
                  <span>Nodes: {isGraphLoading ? <Loader2 className="inline h-3 w-3 animate-spin" /> : graphNodes.length}</span>
                  <span className="mx-2">|</span>
                  <span>Relationships: {isGraphLoading ? <Loader2 className="inline h-3 w-3 animate-spin" /> : graphEdges.length}</span>
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRefreshAll}
                  disabled={isUploading || isDeleting || isPreprocessing}
                  title="Refresh Files and Status"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Input
                  type="file"
                  accept=".json,.md,.txt,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  ref={fileInputRef}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  size="icon"
                  title={isUploading ? "Uploading..." : "Upload File"}
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  onClick={handleStartPreprocess}
                  disabled={isPreprocessing || files.length === 0}
                  size="icon"
                  title={isPreprocessing ? "Processing..." : "Start Preprocessing"}
                >
                  {isPreprocessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className={cn("p-0 px-3 flex flex-col flex-grow min-h-0")}>
              {files.length === 0 ? (
                <p className="text-muted-foreground p-4">No documents uploaded yet. Upload a PDF to get started!</p>
              ) : (
                <ScrollArea className="flex-grow h-0 hide-scrollbar"> {/* Added hide-scrollbar here */}
                  <div className="overflow-visible">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-card">
                        <TableRow>
                          <TableHead className="w-[40%]">File Name</TableHead>
                          <TableHead className="w-[15%] text-center">Nodes</TableHead>
                          <TableHead className="w-[25%] text-center">Relationships</TableHead>
                          <TableHead className="w-[20%] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {files.map((file) => {
                          const fileStats = fileGraphData[file] || { nodes: 0, edges: 0 };
                          return (
                            <TableRow key={file}>
                              <TableCell className="font-medium py-2">
                                <div className="flex items-center">
                                  {getFileIcon(file)}
                                  {file}
                                </div>
                              </TableCell>
                              <TableCell className="text-center py-2">
                                {isGraphLoading ? <Loader2 className="inline h-3 w-3 animate-spin" /> : fileStats.nodes}
                              </TableCell>
                              <TableCell className="text-center py-2">
                                {isGraphLoading ? <Loader2 className="inline h-3 w-3 animate-spin" /> : fileStats.edges}
                              </TableCell>
                              <TableCell className="text-right py-2">
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm" disabled={isDeleting}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete the file
                                        &quot;{file}&quot; from your workspace.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeleteFile(file)}>
                                        Continue
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* New Charts Section */}
          <div className="grid grid-cols-1 gap-4 min-h-[300px]">
            <NodeTypeDistributionChart nodes={graphNodes} isLoading={isGraphLoading} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Documents;