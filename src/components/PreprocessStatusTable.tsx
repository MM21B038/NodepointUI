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
import { Loader2, Play, RefreshCw, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import FileUpload from "@/components/FileUpload";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  getWorkspacePreprocessStatus,
  uploadFiles,
  type ChunkPipelineCounts,
  type PreprocessPhase,
  type WorkspacePreprocessStatusResponse,
} from "@/database/workspaceStorage";
import type { OwnerParams } from "@/lib/ownerScope";
import {
  countFilesInProgress,
  friendlyPhaseLabel,
  showUserRetryButton,
  type PreprocessTableVariant,
} from "@/lib/preprocessUserCopy";
import { cn } from "@/lib/utils";
import { brand } from "@/lib/brandColors";
import { showError, showSuccess } from "@/utils/toast";
import DocumentsPageSkeleton from "@/components/documents/DocumentsPageSkeleton";
import WorkspaceReadinessBanner from "@/components/documents/WorkspaceReadinessBanner";
import { Skeleton } from "@/components/ui/skeleton";

const POLL_MS = 2500;

interface FileGraphCounts {
  nodes: number;
  edges: number;
}

interface PreprocessStatusTableProps {
  workspaceName: string;
  owner?: OwnerParams;
  refreshToken?: number;
  onStatusChange?: (status: WorkspacePreprocessStatusResponse) => void;
  onRefreshAll?: () => void;
  totalNodes?: number;
  totalEdges?: number;
  fileGraphData?: Record<string, FileGraphCounts>;
  isGraphLoading?: boolean;
  onDeleteFile?: (fileName: string) => void;
  onDeleteFiles?: (fileNames: string[]) => void;
  isDeleting?: boolean;
  onUploadSuccess?: () => void;
  onStartPreprocess?: () => void;
  isPreprocessing?: boolean;
  variant?: PreprocessTableVariant;
  /** @deprecated Use variant="admin" | "user" */
  showPipelineUI?: boolean;
}

function formatPhaseLabel(phase: PreprocessPhase): string {
  switch (phase) {
    case "idle":
      return "Idle";
    case "needs_prepare":
      return "Needs prepare";
    case "queued":
      return "Queued";
    case "processing":
      return "Processing";
    case "embedding":
      return "Embedding";
    case "ready":
      return "Ready";
    case "kg_ready":
      return "Ready";
    case "failed":
      return "Failed";
    default:
      return phase;
  }
}

function PhaseBadge({
  phase,
  variant,
}: {
  phase: PreprocessPhase;
  variant: PreprocessTableVariant;
}) {
  const label =
    variant === "user" ? friendlyPhaseLabel(phase) : formatPhaseLabel(phase);
  switch (phase) {
    case "ready":
    case "kg_ready":
      return <Badge className="bg-green-600 hover:bg-green-600">{label}</Badge>;
    case "failed":
      return <Badge variant="destructive">{label}</Badge>;
    case "processing":
    case "embedding":
      return <Badge>{label}</Badge>;
    case "needs_prepare":
      return (
        <Badge
          variant="outline"
          className={cn(brand.warning.border, brand.warning.text, "border")}
        >
          {label}
        </Badge>
      );
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

function GraphStatCard({
  label,
  value,
  isLoading,
}: {
  label: string;
  value: number;
  isLoading?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      {isLoading ? (
        <Skeleton className="mt-1 h-5 w-10" />
      ) : (
        <p className="font-medium tabular-nums">{value}</p>
      )}
    </div>
  );
}

function shouldPoll(status: WorkspacePreprocessStatusResponse | null): boolean {
  if (!status) return true;
  if (status.overall.ready) return false;
  return status.overall.phase !== "idle";
}

function resolveVariant(
  variant: PreprocessTableVariant | undefined,
  showPipelineUI: boolean | undefined
): PreprocessTableVariant {
  if (variant) return variant;
  return showPipelineUI === false ? "user" : showPipelineUI ? "admin" : "user";
}

const PreprocessStatusTable: React.FC<PreprocessStatusTableProps> = ({
  workspaceName,
  owner,
  refreshToken = 0,
  onStatusChange,
  onRefreshAll,
  totalNodes = 0,
  totalEdges = 0,
  fileGraphData = {},
  isGraphLoading = false,
  onDeleteFile,
  onDeleteFiles,
  isDeleting = false,
  onUploadSuccess,
  onStartPreprocess,
  isPreprocessing = false,
  variant: variantProp,
  showPipelineUI,
}) => {
  const variant = resolveVariant(variantProp, showPipelineUI);
  const isAdmin = variant === "admin";

  const [status, setStatus] = useState<WorkspacePreprocessStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const fileNames = status?.files.map((file) => file.file_name) ?? [];
  const allSelected =
    fileNames.length > 0 && fileNames.every((name) => selectedFiles.has(name));
  const someSelected = selectedFiles.size > 0;
  const selectionIndeterminate = someSelected && !allSelected;

  const showRetry =
    !isAdmin && onStartPreprocess && showUserRetryButton(status);
  const showAdminStart = isAdmin && onStartPreprocess;

  useEffect(() => {
    setSelectedFiles((prev) => {
      const next = new Set<string>();
      for (const name of prev) {
        if (fileNames.includes(name)) next.add(name);
      }
      return next;
    });
  }, [workspaceName, fileNames.join("\0")]);

  const toggleFileSelection = (fileName: string, checked: boolean) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (checked) next.add(fileName);
      else next.delete(fileName);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedFiles(checked ? new Set(fileNames) : new Set());
  };

  const handleBulkDelete = () => {
    if (selectedFiles.size === 0) return;
    onDeleteFiles?.(Array.from(selectedFiles));
  };

  const fetchStatus = useCallback(
    async (showSpinner: boolean) => {
      if (showSpinner) setIsLoading(true);
      try {
        const data = await getWorkspacePreprocessStatus(workspaceName, owner);
        setStatus(data);
        onStatusChangeRef.current?.(data);
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Failed to fetch preprocessing status.";
        showError(message);
        setStatus(null);
      } finally {
        if (showSpinner) setIsLoading(false);
      }
    },
    [workspaceName, owner]
  );

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const run = async (showSpinner: boolean) => {
      if (cancelled) return;
      if (showSpinner) setIsLoading(true);
      try {
        const data = await getWorkspacePreprocessStatus(workspaceName, owner);
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
        const message =
          e instanceof Error ? e.message : "Failed to fetch preprocessing status.";
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
  }, [workspaceName, owner, refreshToken]);

  const handleRefresh = () => {
    void fetchStatus(true);
    onRefreshAll?.();
  };

  const vectorSummary = status?.vectors;
  const inProgressCount = status ? countFilesInProgress(status) : 0;

  return (
    <div className="flex h-full min-h-0 flex-col space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-xl font-semibold tracking-tight">Documents</h2>
          {isAdmin ? (
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              Operator
            </Badge>
          ) : null}
          {status ? (
            <PhaseBadge phase={status.overall.phase} variant={variant} />
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {someSelected && onDeleteFiles ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={handleBulkDelete}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete {selectedFiles.size} selected</span>
            </Button>
          ) : null}
          {onUploadSuccess ? (
            <FileUpload
              workspaceName={workspaceName}
              owner={owner}
              onUploadSuccess={onUploadSuccess}
              variant="outline"
              size="sm"
              enableDragDrop
            />
          ) : null}
          {showRetry ? (
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
                {isPreprocessing ? "Processing…" : "Process documents"}
              </span>
            </Button>
          ) : null}
          {showAdminStart ? (
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
          ) : null}
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
        <DocumentsPageSkeleton variant={variant} />
      ) : !status ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-muted-foreground">Could not load document status.</p>
        </div>
      ) : (
        <>
          {!status.overall.ready ? (
            <WorkspaceReadinessBanner status={status} />
          ) : null}

          {isAdmin ? (
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
              <div className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">Documents</p>
                <p className="font-medium tabular-nums">{status.overall.documents_total}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">Failed docs</p>
                <p className="font-medium tabular-nums">{status.overall.documents_failed}</p>
              </div>
              <GraphStatCard
                label="Entities"
                value={totalNodes}
                isLoading={isGraphLoading}
              />
              <GraphStatCard
                label="Relationships"
                value={totalEdges}
                isLoading={isGraphLoading}
              />
              <div className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">Entity vectors</p>
                <p className="font-medium tabular-nums">
                  {formatVectorSummary(vectorSummary?.entities ?? { completed: 0, total: 0 })}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">Relation vectors</p>
                <p className="font-medium tabular-nums">
                  {formatVectorSummary(vectorSummary?.relations ?? { completed: 0, total: 0 })}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">Chunk vectors</p>
                <p className="font-medium tabular-nums">
                  {formatVectorSummary(vectorSummary?.chunks ?? { completed: 0, total: 0 })}
                </p>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "grid gap-3 text-sm",
                status.overall.ready
                  ? "grid-cols-2 sm:grid-cols-3"
                  : "grid-cols-2 sm:grid-cols-4"
              )}
            >
              <div className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">Files</p>
                <p className="font-medium tabular-nums">{status.overall.documents_total}</p>
              </div>
              <GraphStatCard
                label="Entities"
                value={totalNodes}
                isLoading={isGraphLoading}
              />
              <GraphStatCard
                label="Relationships"
                value={totalEdges}
                isLoading={isGraphLoading}
              />
              {!status.overall.ready ? (
                <div className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2">
                  <p className="text-xs text-muted-foreground">In progress</p>
                  <p className="font-medium tabular-nums">{inProgressCount}</p>
                </div>
              ) : null}
            </div>
          )}

          {status.files.length === 0 ? (
            <FileUploadDropZone
              workspaceName={workspaceName}
              owner={owner}
              onUploadSuccess={onUploadSuccess}
              disabled={!onUploadSuccess}
              variant={variant}
            />
          ) : (
            <ScrollArea className="max-h-[calc(100vh-22rem)] min-h-[240px] flex-1 hide-scrollbar rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    {onDeleteFiles ? (
                      <TableHead className="w-10">
                        <Checkbox
                          checked={
                            allSelected
                              ? true
                              : selectionIndeterminate
                                ? "indeterminate"
                                : false
                          }
                          onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                          aria-label="Select all files"
                          disabled={isDeleting}
                        />
                      </TableHead>
                    ) : null}
                    <TableHead>File</TableHead>
                    <TableHead>{isAdmin ? "Stage" : "Status"}</TableHead>
                    <TableHead className="text-center">Entities</TableHead>
                    <TableHead className="text-center">Relationships</TableHead>
                    {isAdmin ? <TableHead>Chunks (KG)</TableHead> : null}
                    <TableHead>Progress</TableHead>
                    <TableHead className="hidden lg:table-cell">Uploaded</TableHead>
                    <TableHead className="w-12 text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {status.files.map((file) => {
                    const graphCounts = fileGraphData[file.file_name] ?? {
                      nodes: 0,
                      edges: 0,
                    };
                    const isSelected = selectedFiles.has(file.file_name);
                    return (
                      <TableRow
                        key={file.id}
                        data-state={isSelected ? "selected" : undefined}
                        className={cn(isSelected && "bg-muted/40")}
                      >
                        {onDeleteFiles ? (
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) =>
                                toggleFileSelection(file.file_name, checked === true)
                              }
                              aria-label={`Select ${file.file_name}`}
                              disabled={isDeleting}
                            />
                          </TableCell>
                        ) : null}
                        <TableCell
                          className="max-w-[180px] truncate font-medium"
                          title={file.file_name}
                        >
                          {file.file_name}
                        </TableCell>
                        <TableCell>
                          <PhaseBadge phase={file.phase} variant={variant} />
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
                        {isAdmin ? (
                          <TableCell className="text-xs tabular-nums text-muted-foreground">
                            {formatChunkSummary(file.chunks)}
                          </TableCell>
                        ) : null}
                        <TableCell className="min-w-[100px]">
                          <div className="flex items-center gap-2">
                            <Progress
                              value={Math.min(
                                100,
                                Math.max(0, file.embedding_progress * 100)
                              )}
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
                          {onDeleteFile ? (
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
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}

          {shouldPoll(status) ? (
            <p className="text-xs text-muted-foreground">
              Auto-refreshing every few seconds…
            </p>
          ) : null}
        </>
      )}
    </div>
  );
};

const ALLOWED_UPLOAD_EXTENSIONS = [".txt", ".md"] as const;

function isAllowedUploadFile(file: File): boolean {
  const ext = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
  return (ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(ext);
}

function FileUploadDropZone({
  workspaceName,
  owner,
  onUploadSuccess,
  disabled = false,
  variant = "user",
}: {
  workspaceName: string;
  owner?: OwnerParams;
  onUploadSuccess?: () => void;
  disabled?: boolean;
  variant?: PreprocessTableVariant;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const dragDepthRef = useRef(0);

  const handleUpload = async (fileList: FileList | File[]) => {
    if (disabled || !onUploadSuccess) return;
    const files = Array.from(fileList).filter(isAllowedUploadFile);
    if (files.length === 0) {
      showError("Only .txt and .md files can be uploaded.");
      return;
    }

    setIsUploading(true);
    try {
      const result = await uploadFiles(workspaceName, files, owner);
      if (result.succeeded.length > 0) {
        onUploadSuccess();
        if (result.replaced.length > 0) {
          showSuccess(
            `${result.replaced.length} file${result.replaced.length === 1 ? "" : "s"} replaced and re-queued for processing.`
          );
        }
      }
      if (result.failed.length > 0 && result.succeeded.length === 0) {
        showError(result.failed[0]?.error ?? "Upload failed");
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className={cn(
        "flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border/60 bg-muted/20 px-6 py-10 transition-colors",
        isDragging && "border-primary bg-primary/5",
        disabled && "opacity-60"
      )}
      onDragEnter={(event) => {
        event.preventDefault();
        dragDepthRef.current += 1;
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) setIsDragging(false);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={async (event) => {
        event.preventDefault();
        dragDepthRef.current = 0;
        setIsDragging(false);
        await handleUpload(event.dataTransfer.files);
      }}
    >
      <Upload className="h-10 w-10 text-muted-foreground/70" aria-hidden />
      <p className="max-w-md text-center text-sm text-muted-foreground">
        {isUploading
          ? "Uploading files…"
          : isDragging
            ? "Drop .txt or .md files here"
            : variant === "admin"
              ? "No files yet. Upload or drag documents here — preprocessing starts automatically after upload."
              : "No documents yet. Drop .txt or .md files here or use Upload — we'll process them for chat and search."}
      </p>
    </div>
  );
}

export default PreprocessStatusTable;
