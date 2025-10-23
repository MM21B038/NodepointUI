"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChunkEntry, PipelineStatusResponse } from "@/database/workspaceStorage";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PipelineStatusDialogProps {
  isOpen: boolean;
  onClose: () => void;
  data: PipelineStatusResponse | null;
}

const getStatusBadge = (status: ChunkEntry['status']) => {
  switch (status) {
    case 'running':
      return <Badge className="bg-blue-500 hover:bg-blue-500">Running</Badge>;
    case 'queued':
      return <Badge variant="secondary">Queued</Badge>;
    case 'success':
      return <Badge className="bg-green-500 hover:bg-green-500">Success</Badge>;
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const PipelineStatusDialog: React.FC<PipelineStatusDialogProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  const pipelineEntries = data?.pipeline || [];
  const workspaceName = data?.workspace || "N/A";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Pipeline Status: {workspaceName}</DialogTitle>
        </DialogHeader>
        
        {data?.error ? (
          <div className="text-red-500 p-4 border border-red-300 rounded-md">
            Error loading status: {data.error}
          </div>
        ) : pipelineEntries.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No active or queued chunks found.
          </div>
        ) : (
          <ScrollArea className="flex-grow max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Range</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Queue Pos</TableHead>
                  <TableHead>PID</TableHead>
                  <TableHead>CPU/Mem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pipelineEntries.map((entry) => (
                  <TableRow key={entry.chunk_uuid}>
                    <TableCell className="font-medium max-w-[150px] truncate">
                      {entry.pdf}
                    </TableCell>
                    <TableCell>
                      {entry.range ? `${entry.range[0]}-${entry.range[1]}` : 'N/A'}
                    </TableCell>
                    <TableCell>{getStatusBadge(entry.status)}</TableCell>
                    <TableCell>{entry.queued_position ?? '-'}</TableCell>
                    <TableCell>{entry.pid ?? '-'}</TableCell>
                    <TableCell>
                      {entry.pid_cpu_percent !== null ? `${entry.pid_cpu_percent.toFixed(1)}%` : '-'} / 
                      {entry.pid_mem_mb !== null ? `${entry.pid_mem_mb.toFixed(1)}MB` : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PipelineStatusDialog;