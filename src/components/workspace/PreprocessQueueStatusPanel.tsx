"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronRight,
  Loader2,
  RefreshCw,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getPreprocessQueueStatus,
  type PreprocessQueueStatusResponse,
} from "@/database/workspaceStorage";
import { cn } from "@/lib/utils";
import PreprocessQueueStatusDetail from "@/components/workspace/PreprocessQueueStatusDetail";
import {
  computePreprocessSummary,
  formatTimestamp,
  hasPreprocessActivity,
  PREPROCESS_POLL_MS,
  shouldPollPreprocessStatus,
} from "@/components/workspace/preprocessQueueStatusUtils";

interface PreprocessQueueStatusPanelProps {
  /** Omit for global ops snapshot (workspace management). */
  workspaceName?: string;
  className?: string;
}

const PreprocessQueueStatusPanel = ({
  workspaceName,
  className,
}: PreprocessQueueStatusPanelProps) => {
  const [data, setData] = useState<PreprocessQueueStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [workspaceTableRefresh, setWorkspaceTableRefresh] = useState(0);

  const fetchStatus = useCallback(
    async (showSpinner: boolean) => {
      if (showSpinner) setIsLoading(true);
      try {
        const snapshot = await getPreprocessQueueStatus(workspaceName);
        setData(snapshot);
        setError(null);
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Failed to load queue status.";
        setError(message);
        setData(null);
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
        const snapshot = await getPreprocessQueueStatus(workspaceName);
        if (cancelled) return;
        setData(snapshot);
        setError(null);
        if (shouldPollPreprocessStatus(snapshot)) {
          if (!intervalId) {
            intervalId = setInterval(() => {
              void run(false);
            }, PREPROCESS_POLL_MS);
          }
        } else if (intervalId) {
          clearInterval(intervalId);
          intervalId = undefined;
        }
      } catch (e) {
        if (cancelled) return;
        const message =
          e instanceof Error ? e.message : "Failed to load queue status.";
        setError(message);
        setData(null);
      } finally {
        if (!cancelled && showSpinner) setIsLoading(false);
      }
    };

    void run(true);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [workspaceName]);

  useEffect(() => {
    if (!modalOpen) return;
    void fetchStatus(false);
    setWorkspaceTableRefresh((n) => n + 1);
  }, [modalOpen, fetchStatus]);

  const title = workspaceName
    ? `Pipeline — ${workspaceName}`
    : "Preprocess pipeline";

  const subtitle = workspaceName
    ? "RQ queues, workers, and backlog for this workspace"
    : "Global operations snapshot across all workspaces";

  const active = hasPreprocessActivity(data);
  const summary = data ? computePreprocessSummary(data) : null;

  return (
    <>
      <div
        className={cn(
          "shrink-0 border-b border-border/60 bg-gradient-to-r from-muted/30 to-muted/10 px-3 py-2",
          className
        )}
      >
        <div
          role="button"
          tabIndex={error && !data ? -1 : 0}
          onClick={() => {
            if (!error || data) setModalOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!error || data) setModalOpen(true);
            }
          }}
          className={cn(
            "rounded-lg border bg-card/80 px-3 py-2.5 text-left w-full",
            "shadow-sm transition-colors hover:bg-accent/40 hover:border-primary/30",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:opacity-60",
            error && !data && "opacity-60 pointer-events-none"
          )}
        >
            <div className="flex items-center gap-2 mb-2">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                  active ? "bg-primary/15" : "bg-muted"
                )}
              >
                <Server
                  className={cn(
                    "h-4 w-4",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold truncate">{title}</span>
                  {active ? (
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                    </span>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] h-5 font-normal">
                      idle
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  Click for full details ·{" "}
                  {data
                    ? `Updated ${formatTimestamp(data.generated_at)}`
                    : isLoading
                      ? "Loading…"
                      : error ?? "No data"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  setWorkspaceTableRefresh((n) => n + 1);
                  void fetchStatus(true);
                }}
                disabled={isLoading}
                aria-label="Refresh pipeline status"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>

            {isLoading && !data ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-md" />
                ))}
              </div>
            ) : error ? (
              <p className="text-xs text-destructive">{error}</p>
            ) : summary ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-1.5">
                <MetricPill
                  label="Queued"
                  value={summary.queued}
                  highlight={summary.queued > 0}
                />
                <MetricPill
                  label="Running"
                  value={summary.started}
                  highlight={summary.started > 0}
                />
                <MetricPill
                  label="Failed"
                  value={summary.failed}
                  danger={summary.failed > 0}
                />
                <MetricPill
                  label="Workers"
                  value={`${summary.workersBusy}/${summary.workerTotal}`}
                />
                {!workspaceName && summary.incompleteCount > 0 && (
                  <MetricPill
                    label="Incomplete"
                    value={summary.incompleteCount}
                    highlight
                  />
                )}
                {summary.lockCount > 0 && (
                  <MetricPill label="Locks" value={summary.lockCount} highlight />
                )}
              </div>
            ) : null}
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          className={cn(
            "flex flex-col gap-0 p-0 overflow-hidden",
            "max-w-6xl w-[min(96vw,72rem)] h-[min(90vh,52rem)]"
          )}
        >
          <DialogHeader className="shrink-0 px-6 pt-6 pb-4 border-b space-y-1">
            <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
              <div>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <Server className="h-5 w-5 text-primary" />
                  {title}
                  {active && (
                    <Badge className="font-normal">active</Badge>
                  )}
                </DialogTitle>
                <DialogDescription>{subtitle}</DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                {data && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Snapshot {formatTimestamp(data.generated_at)}
                  </span>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => {
                    setWorkspaceTableRefresh((n) => n + 1);
                    void fetchStatus(true);
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Refresh
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 px-6 py-4 overflow-hidden flex flex-col">
            {isLoading && !data ? (
              <div className="space-y-3 flex-1">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            ) : error && !data ? (
              <div className="flex flex-col items-center justify-center flex-1 text-center gap-2">
                <p className="text-sm text-destructive">{error}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void fetchStatus(true)}
                >
                  Retry
                </Button>
              </div>
            ) : data ? (
              <PreprocessQueueStatusDetail
                data={data}
                overviewLoadActive={modalOpen}
                overviewRefreshKey={
                  modalOpen
                    ? shouldPollPreprocessStatus(data)
                      ? `${workspaceTableRefresh}:${data.generated_at}`
                      : String(workspaceTableRefresh)
                    : undefined
                }
                workspaceName={workspaceName}
                className="flex-1 min-h-0"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

function MetricPill({
  label,
  value,
  highlight = false,
  danger = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-2 py-1.5 bg-background/60",
        highlight && "border-primary/30 bg-primary/5",
        danger && "border-destructive/40 bg-destructive/5"
      )}
    >
      <p className="text-[10px] text-muted-foreground leading-none">{label}</p>
      <p
        className={cn(
          "text-sm font-semibold tabular-nums mt-0.5",
          danger && "text-destructive"
        )}
      >
        {value}
      </p>
    </div>
  );
}

export default PreprocessQueueStatusPanel;
