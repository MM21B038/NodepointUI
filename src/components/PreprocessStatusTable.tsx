"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  getWorkspacePreprocessStatus,
  type PreprocessPhase,
  type WorkspacePreprocessStatusResponse,
} from "@/database/workspaceStorage";
import { cn } from "@/lib/utils";
import { showError } from "@/utils/toast";

const POLL_MS = 2500;

interface PreprocessStatusTableProps {
  workspaceName: string;
  /** Bump to force an immediate refetch (e.g. after starting preprocess). */
  refreshToken?: number;
  onStatusChange?: (status: WorkspacePreprocessStatusResponse) => void;
}

function formatPhaseLabel(phase: PreprocessPhase): string {
  switch (phase) {
    case "idle":
      return "Idle";
    case "queued":
      return "Queued";
    case "processing":
      return "Processing";
    case "embedding":
      return "Embedding";
    case "ready":
      return "Ready";
    case "failed":
      return "Failed";
    default:
      return phase;
  }
}

function PhaseBadge({ phase }: { phase: PreprocessPhase }) {
  const label = formatPhaseLabel(phase);
  switch (phase) {
    case "ready":
      return <Badge className="bg-green-600 hover:bg-green-600">{label}</Badge>;
    case "failed":
      return <Badge variant="destructive">{label}</Badge>;
    case "processing":
    case "embedding":
      return <Badge>{label}</Badge>;
    case "queued":
      return <Badge variant="outline">{label}</Badge>;
    case "idle":
    default:
      return <Badge variant="secondary">{label}</Badge>;
  }
}

function formatUploadedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function formatPercent(progress: number): string {
  return `${Math.round(progress * 100)}%`;
}

function shouldPoll(status: WorkspacePreprocessStatusResponse | null): boolean {
  if (!status) return true;
  if (status.overall.ready) return false;
  return status.overall.phase !== "idle";
}

const PreprocessStatusTable: React.FC<PreprocessStatusTableProps> = ({
  workspaceName,
  refreshToken = 0,
  onStatusChange,
}) => {
  const [status, setStatus] = useState<WorkspacePreprocessStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const fetchStatus = useCallback(
    async (showSpinner: boolean) => {
      if (showSpinner) setIsLoading(true);
      try {
        const data = await getWorkspacePreprocessStatus(workspaceName);
        setStatus(data);
        onStatusChangeRef.current?.(data);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to fetch preprocessing status.";
        showError(message);
        setStatus(null);
      } finally {
        if (showSpinner) setIsLoading(false);
      }
    },
    [workspaceName]
  );

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const run = async (showSpinner: boolean) => {
      if (cancelled) return;
      if (showSpinner) setIsLoading(true);
      try {
        const data = await getWorkspacePreprocessStatus(workspaceName);
        if (cancelled) return;
        setStatus(data);
        onStatusChangeRef.current?.(data);

        if (shouldPoll(data)) {
          if (!intervalId) {
            intervalId = setInterval(() => {
              void run(false);
            }, POLL_MS);
          }
        } else if (intervalId) {
          clearInterval(intervalId);
          intervalId = undefined;
        }
      } catch (e) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "Failed to fetch preprocessing status.";
        showError(message);
        setStatus(null);
      } finally {
        if (!cancelled && showSpinner) setIsLoading(false);
      }
    };

    void run(true);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [workspaceName, refreshToken]);

  const handleRefresh = () => {
    void fetchStatus(true);
  };

  const vectorSummary = status?.vectors;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-medium">Preprocessing status</h3>
          {status && <PhaseBadge phase={status.overall.phase} />}
          {status?.overall.ready && (
            <span className="text-xs text-muted-foreground">Safe for chat &amp; search</span>
          )}
        </div>
        <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        </Button>
      </div>

      {isLoading && !status ? (
        <div className="flex h-48 flex-col items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="mt-2 text-muted-foreground">Loading status…</span>
        </div>
      ) : !status ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-muted-foreground">Could not load preprocessing status.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="rounded-md border bg-secondary/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">Documents</p>
              <p className="font-medium tabular-nums">{status.overall.documents_total}</p>
            </div>
            <div className="rounded-md border bg-secondary/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">Failed</p>
              <p className="font-medium tabular-nums">{status.overall.documents_failed}</p>
            </div>
            <div className="rounded-md border bg-secondary/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">Entity vectors</p>
              <p className="font-medium tabular-nums">
                {vectorSummary?.entities.completed ?? 0}/{vectorSummary?.entities.total ?? 0}
              </p>
            </div>
            <div className="rounded-md border bg-secondary/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">Relation vectors</p>
              <p className="font-medium tabular-nums">
                {vectorSummary?.relations.completed ?? 0}/{vectorSummary?.relations.total ?? 0}
              </p>
            </div>
          </div>

          {status.files.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-md border border-dashed">
              <p className="text-muted-foreground">
                No files in this workspace. Upload documents and start preprocessing.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-64 hide-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Doc status</TableHead>
                    <TableHead>Embedding</TableHead>
                    <TableHead className="hidden sm:table-cell">Uploaded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {status.files.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell className="max-w-[180px] truncate font-medium" title={file.file_name}>
                        {file.file_name}
                      </TableCell>
                      <TableCell>
                        <PhaseBadge phase={file.phase} />
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{file.document_status}</span>
                      </TableCell>
                      <TableCell className="min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <Progress
                            value={Math.min(100, Math.max(0, file.embedding_progress * 100))}
                            className="h-2 flex-1"
                          />
                          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                            {formatPercent(file.embedding_progress)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                        {formatUploadedAt(file.uploaded_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}

          {shouldPoll(status) && (
            <p className={cn("text-xs text-muted-foreground")}>Auto-refreshing every few seconds…</p>
          )}
        </>
      )}
    </div>
  );
};

export default PreprocessStatusTable;
