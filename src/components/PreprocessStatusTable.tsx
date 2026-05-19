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
import { GitGraph, Loader2, Play, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import FileUpload from "@/components/FileUpload";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  getWorkspacePreprocessStatus,
  type ChunkPipelineCounts,
  type PreprocessPhase,
  type WorkspacePreprocessStatusResponse,
} from "@/database/workspaceStorage";
import { cn } from "@/lib/utils";
import { showError } from "@/utils/toast";
import DocumentsPageSkeleton from "@/components/documents/DocumentsPageSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

const POLL_MS = 2500;

interface FileGraphCounts {
  nodes: number;
  edges: number;
}

interface PreprocessStatusTableProps {
  workspaceName: string;
  /** Bump to force an immediate refetch (e.g. after starting preprocess). */
  refreshToken?: number;
  onStatusChange?: (status: WorkspacePreprocessStatusResponse) => void;
  onRefreshAll?: () => void;
  totalNodes?: number;
  totalEdges?: number;
  fileGraphData?: Record<string, FileGraphCounts>;
  isGraphLoading?: boolean;
  onDeleteFile?: (fileName: string) => void;
  isDeleting?: boolean;
  onUploadSuccess?: () => void;
  onStartPreprocess?: () => void;
  isPreprocessing?: boolean;
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
    case "kg_ready":
      return "KG ready";
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
    case "kg_ready":
      return <Badge variant="secondary">{label}</Badge>;
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

function formatChunkSummary(chunks: ChunkPipelineCounts): string {
  if (chunks.total === 0) return "—";
  const active = chunks.queued + chunks.in_progress;
  const base = `${chunks.completed}/${chunks.total}`;
  if (active > 0) return `${base} (${active} active)`;
  if (chunks.failed > 0) return `${base} (${chunks.failed} failed)`;
  return base;
}

function formatVectorSummary(v: { completed: number; total: number }): string {
  if (v.total === 0) return "—";
  return `${v.completed}/${v.total}`;
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
  onRefreshAll,
  totalNodes = 0,
  totalEdges = 0,
  fileGraphData = {},
  isGraphLoading = false,
  onDeleteFile,
  isDeleting = false,
  onUploadSuccess,
  onStartPreprocess,
  isPreprocessing = false,
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
    onRefreshAll?.();
  };

  const vectorSummary = status?.vectors;

  return (
    <div className="flex h-full min-h-0 flex-col space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-medium">Preprocessing status</h3>
          {status && <PhaseBadge phase={status.overall.phase} />}
          {status?.overall.ready && (
            <span className="text-xs text-muted-foreground">Safe for chat &amp; search</span>
          )}
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <GitGraph className="h-4 w-4" />
            {isGraphLoading ? (
              <span className="flex items-center gap-1.5">
                <Skeleton className="h-3 w-10" />
                <span>·</span>
                <Skeleton className="h-3 w-16" />
              </span>
            ) : (
              <>
                <span className="tabular-nums">{totalNodes} entities</span>
                <span>·</span>
                <span className="tabular-nums">{totalEdges} relationships</span>
              </>
            )}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onUploadSuccess && (
            <FileUpload
              workspaceName={workspaceName}
              onUploadSuccess={onUploadSuccess}
              variant="outline"
              size="sm"
            />
          )}
          {onStartPreprocess && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPreprocessing || isDeleting || isLoading}
              onClick={onStartPreprocess}
              className="gap-2"
            >
              {isPreprocessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {isPreprocessing ? "Starting…" : "Start preprocessing"}
              </span>
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
            title="Refresh status"
          >
            <RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
        </div>
      </div>

      {isLoading && !status ? (
        <DocumentsPageSkeleton />
      ) : !status ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-muted-foreground">Could not load preprocessing status.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-md border bg-secondary/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">Documents</p>
              <p className="font-medium tabular-nums">{status.overall.documents_total}</p>
            </div>
            <div className="rounded-md border bg-secondary/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">Failed docs</p>
              <p className="font-medium tabular-nums">{status.overall.documents_failed}</p>
            </div>
            <div className="rounded-md border bg-secondary/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">Entity vectors</p>
              <p className="font-medium tabular-nums">
                {formatVectorSummary(vectorSummary?.entities ?? { completed: 0, total: 0 })}
              </p>
            </div>
            <div className="rounded-md border bg-secondary/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">Relation vectors</p>
              <p className="font-medium tabular-nums">
                {formatVectorSummary(vectorSummary?.relations ?? { completed: 0, total: 0 })}
              </p>
            </div>
            <div className="rounded-md border bg-secondary/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">Chunk vectors</p>
              <p className="font-medium tabular-nums">
                {formatVectorSummary(vectorSummary?.chunks ?? { completed: 0, total: 0 })}
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
            <ScrollArea className="max-h-[calc(100vh-22rem)] min-h-[240px] flex-1 hide-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-center">Entities</TableHead>
                    <TableHead className="text-center">Relationships</TableHead>
                    <TableHead>Chunks (KG)</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead className="hidden lg:table-cell">Uploaded</TableHead>
                    <TableHead className="w-12 text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {status.files.map((file) => {
                    const graphCounts = fileGraphData[file.file_name] ?? { nodes: 0, edges: 0 };
                    return (
                      <TableRow key={file.id}>
                        <TableCell className="max-w-[180px] truncate font-medium" title={file.file_name}>
                          {file.file_name}
                        </TableCell>
                        <TableCell>
                          <PhaseBadge phase={file.phase} />
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          {isGraphLoading ? (
                            <Loader2 className="mx-auto h-3 w-3 animate-spin" />
                          ) : (
                            graphCounts.nodes
                          )}
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          {isGraphLoading ? (
                            <Loader2 className="mx-auto h-3 w-3 animate-spin" />
                          ) : (
                            graphCounts.edges
                          )}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums text-muted-foreground">
                          {formatChunkSummary(file.chunks)}
                        </TableCell>
                        <TableCell className="min-w-[100px]">
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
                        <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                          {formatUploadedAt(file.uploaded_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          {onDeleteFile && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              disabled={isDeleting}
                              onClick={() => onDeleteFile(file.file_name)}
                              aria-label={`Delete ${file.file_name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
