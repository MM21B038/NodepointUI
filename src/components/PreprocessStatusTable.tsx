"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPreprocessStatus, FilePreprocessStatus } from "@/database/workspaceStorage";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { usePipelineStatus } from "@/hooks/usePipelineStatus";

interface PreprocessStatusTableProps {
  workspaceName: string;
}

const getStatusBadge = (status: FilePreprocessStatus['status']) => {
  switch (status) {
    case 'success':
      return <Badge className="bg-green-500 hover:bg-green-500">Success</Badge>;
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>;
    case 'pending':
    default:
      return <Badge variant="secondary">Pending</Badge>;
  }
};

const PreprocessStatusTable: React.FC<PreprocessStatusTableProps> = ({
  workspaceName,
}) => {
  const { isPipelineRunning, refetch: refetchPipelineStatus } = usePipelineStatus(workspaceName);
  
  const [statusData, setStatusData] = useState<FilePreprocessStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getPreprocessStatus(workspaceName);
      if (response.error) {
        toast.error(response.error);
        setStatusData([]);
      } else {
        setStatusData(response.files);
      }
    } catch (e) {
      toast.error("Failed to fetch preprocessing status.");
      setStatusData([]);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceName]);

  // 1. Fetch status when workspace changes
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // 2. If the pipeline is running, automatically refresh the status summary every 5 seconds
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    if (isPipelineRunning) {
      // If pipeline is running, refresh the summary table every 5 seconds
      intervalId = setInterval(() => {
        void fetchStatus();
      }, 5000);
    } else {
      // When pipeline stops, do one final refresh to get the completed status
      if (!isLoading) {
        void fetchStatus();
      }
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isPipelineRunning, fetchStatus, isLoading]);


  const handleRefresh = () => {
    // Manually refresh both the pipeline status (which triggers polling if running)
    // and the file status summary.
    refetchPipelineStatus();
    fetchStatus();
    toast.info("Preprocessing status refreshed.");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center border-b pb-2">
        <h3 className="text-xl font-medium">Preprocessing Status Summary</h3>
        <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        </Button>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : statusData.length === 0 ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">
            No processing report found. Start preprocessing to generate a report.
          </p>
        </div>
      ) : (
        <ScrollArea className="h-64">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Pages</TableHead>
                <TableHead>Chunks</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start Time</TableHead>
                <TableHead>Total Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statusData.map((file) => (
                <TableRow key={file.pdf_name}>
                  <TableCell className="font-medium max-w-[150px] truncate">
                    {file.pdf_name}
                  </TableCell>
                  <TableCell>{file.total_pages}</TableCell>
                  <TableCell>{file.chunks_total}</TableCell>
                  <TableCell>{getStatusBadge(file.status)}</TableCell>
                  <TableCell>{file.start_time || '-'}</TableCell>
                  <TableCell>{file.total_time || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      )}
    </div>
  );
};

export default PreprocessStatusTable;