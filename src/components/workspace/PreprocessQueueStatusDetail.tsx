"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Database,
  HardDrive,
  Layers,
  Loader2,
  Lock,
  Server,
  Workflow,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PreprocessQueueStatusResponse } from "@/database/workspaceStorage";
import { cn } from "@/lib/utils";
import { brand } from "@/lib/brandColors";
import {
  computePreprocessSummary,
  fetchWorkspacePreprocessTableRows,
  formatArgsSummary,
  formatPreprocessPhaseLabel,
  formatTimestamp,
  formatTtl,
  orderedQueueNames,
  queueActivityTotal,
  type WorkspacePreprocessTableRow,
} from "@/components/workspace/preprocessQueueStatusUtils";

interface PreprocessQueueStatusDetailProps {
  data: PreprocessQueueStatusResponse;
  /** Global queue-status snapshot id for refreshing the workspace table. */
  overviewRefreshKey?: string;
  /** Fetch workspace table when the pipeline modal is open. */
  overviewLoadActive?: boolean;
  workspaceName?: string;
  className?: string;
}

function StatCard({
  label,
  value,
  sub,
  variant = "default",
}: {
  label: string;
  value: string | number;
  sub?: string;
  variant?: "default" | "warn" | "danger" | "ok";
}) {
  return (
    <Card
      className={cn(
        "shadow-none",
        variant === "warn" && cn(brand.warning.border, brand.warning.bg, "border"),
        variant === "danger" && "border-destructive/40 bg-destructive/5",
        variant === "ok" && "border-green-500/30 bg-green-500/5"
      )}
    >
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold tabular-nums mt-0.5">{value}</p>
        {sub ? (
          <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PhaseBadge({ phase }: { phase: string }) {
  const isFailed = phase === "failed";
  const isReady = phase === "ready" || phase === "kg_ready";
  const label = formatPreprocessPhaseLabel(phase);
  return (
    <Badge
      variant={isFailed ? "destructive" : isReady ? "default" : "secondary"}
      className={cn(
        "font-normal",
        isReady && "bg-green-600 hover:bg-green-600",
        phase === "embedding" || phase === "processing"
          ? "capitalize"
          : undefined
      )}
    >
      {label}
    </Badge>
  );
}

type PhaseCountTone =
  | "neutral"
  | "prepare"
  | "queued"
  | "processing"
  | "embedding"
  | "failed"
  | "ready";

const PHASE_COUNT_TONE_CLASS: Record<PhaseCountTone, string> = {
  neutral: "text-foreground",
  prepare: cn(brand.warning.text, "font-medium"),
  queued: "text-muted-foreground font-medium",
  processing: "text-primary font-medium",
  embedding: cn(brand.info.text, "font-medium"),
  failed: "text-destructive font-semibold",
  ready: "text-green-600 dark:text-green-500 font-medium",
};

function CountCell({
  value,
  tone = "neutral",
}: {
  value: number;
  tone?: PhaseCountTone;
}) {
  if (value === 0) {
    return <span className="text-muted-foreground/50">—</span>;
  }
  return (
    <span className={cn("tabular-nums", PHASE_COUNT_TONE_CLASS[tone])}>
      {value}
    </span>
  );
}

function WorkspacesInProgressOverview({
  refreshKey,
  loadActive,
  highlightWorkspace,
}: {
  refreshKey?: string;
  loadActive: boolean;
  highlightWorkspace?: string;
}) {
  const [rows, setRows] = useState<WorkspacePreprocessTableRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showSpinnerRef = useRef(true);

  useEffect(() => {
    if (!loadActive) {
      showSpinnerRef.current = true;
      return;
    }

    const controller = new AbortController();
    const showSpinner = showSpinnerRef.current;
    if (showSpinner) setIsLoading(true);
    setError(null);

    void fetchWorkspacePreprocessTableRows(controller.signal)
      .then((tableRows) => {
        if (!controller.signal.aborted) setRows(tableRows);
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setError(
          e instanceof Error ? e.message : "Failed to load workspace status."
        );
        if (showSpinner) setRows([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          showSpinnerRef.current = false;
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [loadActive, refreshKey]);

  if (!loadActive) return null;
  // Hide entire block unless at least one workspace is not ready (or load failed).
  if (!error && rows.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-medium">Workspaces in progress</h4>
        <span className="text-xs text-muted-foreground tabular-nums flex items-center gap-1.5">
          {isLoading && (
            <Loader2 className="h-3 w-3 animate-spin shrink-0" aria-hidden />
          )}
          {isLoading
            ? "Loading workspaces…"
            : `${rows.length} workspace${rows.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {error ? (
        <p className="text-sm text-destructive rounded-md border border-destructive/30 px-3 py-2">
          {error}
        </p>
      ) : null}

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[8rem]">Workspace</TableHead>
              <TableHead>Overall</TableHead>
              <TableHead className="text-right">Total files</TableHead>
              <TableHead className="text-right">Prepare</TableHead>
              <TableHead className="text-right">Queued</TableHead>
              <TableHead className="text-right">Processing</TableHead>
              <TableHead className="text-right">Embedding</TableHead>
              <TableHead className="text-right">Failed</TableHead>
              <TableHead className="text-right">Ready</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TableCell key={j} className="text-right">
                      <Skeleton className="h-4 w-8 ml-auto" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              rows.map((row) => (
                  <TableRow
                    key={row.workspace}
                    className={cn(
                      highlightWorkspace === row.workspace && "bg-primary/5"
                    )}
                  >
                    <TableCell className="font-medium">{row.workspace}</TableCell>
                    <TableCell>
                      <PhaseBadge phase={row.overallPhase} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {row.totalFiles}
                    </TableCell>
                    <TableCell className="text-right">
                      <CountCell value={row.needsPrepare} tone="prepare" />
                    </TableCell>
                    <TableCell className="text-right">
                      <CountCell value={row.queued} tone="queued" />
                    </TableCell>
                    <TableCell className="text-right">
                      <CountCell value={row.processing} tone="processing" />
                    </TableCell>
                    <TableCell className="text-right">
                      <CountCell value={row.embedding} tone="embedding" />
                    </TableCell>
                    <TableCell className="text-right">
                      <CountCell value={row.failed} tone="failed" />
                    </TableCell>
                    <TableCell className="text-right">
                      <CountCell value={row.ready} tone="ready" />
                    </TableCell>
                  </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function QueueCountsRow({
  queued,
  started,
  failed,
  deferred,
}: {
  queued: number;
  started: number;
  failed: number;
  deferred: number;
}) {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <span className="rounded-md bg-muted px-2 py-0.5 tabular-nums">
        queued <strong>{queued}</strong>
      </span>
      <span className="rounded-md bg-primary/15 px-2 py-0.5 tabular-nums">
        started <strong>{started}</strong>
      </span>
      <span
        className={cn(
          "rounded-md px-2 py-0.5 tabular-nums",
          failed > 0 ? "bg-destructive/15 text-destructive" : "bg-muted"
        )}
      >
        failed <strong>{failed}</strong>
      </span>
      <span className="rounded-md bg-muted px-2 py-0.5 tabular-nums">
        deferred <strong>{deferred}</strong>
      </span>
    </div>
  );
}

const PreprocessQueueStatusDetail = ({
  data,
  overviewRefreshKey,
  overviewLoadActive = false,
  workspaceName,
  className,
}: PreprocessQueueStatusDetailProps) => {
  const summary = computePreprocessSummary(data);
  const isGlobal = !workspaceName;

  const scrollHeight = "h-[calc(90vh-15rem)] max-h-[42rem]";

  return (
    <Tabs defaultValue="overview" className={cn("flex flex-col", className)}>
      <TabsList className="w-full justify-start shrink-0 flex-wrap h-auto gap-1 p-1">
        <TabsTrigger value="overview" className="gap-1.5">
          <Activity className="h-3.5 w-3.5" />
          Overview
        </TabsTrigger>
        <TabsTrigger value="queues" className="gap-1.5">
          <Layers className="h-3.5 w-3.5" />
          RQ queues
        </TabsTrigger>
        <TabsTrigger value="workers" className="gap-1.5">
          <Server className="h-3.5 w-3.5" />
          Workers
          {summary.workerTotal > 0 && (
            <span className="text-muted-foreground">({summary.workerTotal})</span>
          )}
        </TabsTrigger>
        <TabsTrigger value="database" className="gap-1.5">
          <Database className="h-3.5 w-3.5" />
          Database
        </TabsTrigger>
        <TabsTrigger value="pipelines" className="gap-1.5">
          <Workflow className="h-3.5 w-3.5" />
          Pipelines
          {(summary.activePipelineCount > 0 || summary.lockCount > 0) && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {summary.activePipelineCount + summary.lockCount}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-3 focus-visible:outline-none">
        <ScrollArea className={cn(scrollHeight, "pr-3")}>
          <div className="space-y-4 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            <StatCard
              label="Jobs waiting"
              value={summary.queued}
              sub={`${summary.started} in flight`}
              variant={summary.queued > 0 ? "warn" : "default"}
            />
            <StatCard
              label="Failed jobs"
              value={summary.failed}
              variant={summary.failed > 0 ? "danger" : "ok"}
            />
            <StatCard
              label="Workers"
              value={`${summary.workersBusy}/${summary.workerTotal}`}
              sub="busy / registered"
              variant={summary.workersBusy > 0 ? "default" : "default"}
            />
            <StatCard
              label="Pipeline locks"
              value={summary.lockCount}
              variant={summary.lockCount > 0 ? "warn" : "ok"}
            />
            {isGlobal && (
              <StatCard
                label="Incomplete workspaces"
                value={summary.incompleteCount}
                variant={summary.incompleteCount > 0 ? "warn" : "ok"}
              />
            )}
            <StatCard
              label="Vector backlog"
              value={summary.vectorBacklog}
              sub="pending + failed"
              variant={summary.vectorBacklog > 0 ? "warn" : "ok"}
            />
            <StatCard label="Documents" value={summary.docTotal} sub="total rows" />
            <StatCard label="Chunks" value={summary.chunkTotal} sub="total rows" />
            {summary.chunksOrphaned > 0 && (
              <StatCard
                label="Orphaned chunks"
                value={summary.chunksOrphaned}
                sub="stale after restart"
                variant="danger"
              />
            )}
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Queue depth</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {orderedQueueNames(data.rq.queues).map((name) => {
                const q = data.rq.queues[name];
                if (!q) return null;
                const active = q.counts.queued + q.counts.started;
                return (
                  <Card key={name} className="shadow-none">
                    <CardHeader className="py-2 px-3">
                      <CardTitle className="text-sm font-medium capitalize flex items-center justify-between">
                        {name}
                        {q.counts.failed > 0 ? (
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                        ) : active > 0 ? (
                          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                        ) : null}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 pt-0">
                      <QueueCountsRow {...q.counts} />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <Separator />

          <WorkspacesInProgressOverview
            loadActive={overviewLoadActive}
            refreshKey={overviewRefreshKey}
            highlightWorkspace={workspaceName}
          />

          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="queues" className="mt-3 focus-visible:outline-none">
        <ScrollArea className={cn(scrollHeight, "pr-3")}>
          <div className="space-y-6 pb-4">
          {orderedQueueNames(data.rq.queues).map((queueName) => {
            const q = data.rq.queues[queueName];
            if (!q) return null;
            const hasContent =
              q.jobs.length > 0 ||
              q.failed_sample.length > 0 ||
              q.counts.queued +
                q.counts.started +
                q.counts.failed +
                q.counts.deferred >
                0;

            if (!hasContent) return null;

            return (
              <section key={queueName}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <h4 className="text-sm font-semibold capitalize">{queueName}</h4>
                  <QueueCountsRow {...q.counts} />
                </div>

                {q.jobs.length > 0 ? (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[7rem]">Job ID</TableHead>
                          <TableHead>Function</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Origin</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Started</TableHead>
                          <TableHead className="min-w-[10rem]">Args</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {q.jobs.map((job) => (
                          <TableRow key={job.id}>
                            <TableCell className="font-mono text-xs">
                              {job.id}
                            </TableCell>
                            <TableCell className="text-xs max-w-[12rem]">
                              {job.function}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-normal">
                                {job.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {job.origin_queue}
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              {formatTimestamp(job.created_at)}
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              {formatTimestamp(job.started_at)}
                            </TableCell>
                            <TableCell className="text-xs font-mono break-all">
                              {formatArgsSummary(job.args_summary)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-2">
                    No job samples in this queue.
                  </p>
                )}

                {q.failed_sample.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-medium text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Failed jobs ({q.failed_sample.length})
                    </p>
                    {q.failed_sample.map((job) => (
                      <div
                        key={job.id}
                        className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs space-y-1"
                      >
                        <p className="font-mono text-[11px] break-all">{job.id}</p>
                        <p>
                          <span className="font-medium">{job.function}</span>
                          {" · "}
                          {formatArgsSummary(job.args_summary)}
                        </p>
                        <pre className="text-destructive/90 whitespace-pre-wrap break-words font-sans text-[11px] leading-relaxed">
                          {job.error}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
                <Separator className="mt-4" />
              </section>
            );
          })}
          {queueActivityTotal(data) === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              All monitored queues are idle.
            </p>
          )}
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="workers" className="mt-3 focus-visible:outline-none">
        <ScrollArea className={cn(scrollHeight, "pr-3")}>
          <div className="pb-4">
          {data.rq.workers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No RQ workers registered.
            </p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Worker</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Queues</TableHead>
                    <TableHead>Current job</TableHead>
                    <TableHead>Birth</TableHead>
                    <TableHead>Last heartbeat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rq.workers.map((w) => (
                    <TableRow key={w.name}>
                      <TableCell className="font-mono text-xs">{w.name}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            w.state === "busy" ? "default" : "secondary"
                          }
                          className="font-normal capitalize"
                        >
                          {w.state}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {w.queues.join(", ")}
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-[10rem] truncate">
                        {w.current_job_id ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatTimestamp(w.birth_date)}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatTimestamp(w.last_heartbeat)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="database" className="mt-3 focus-visible:outline-none">
        <ScrollArea className={cn(scrollHeight, "pr-3")}>
          <div className="space-y-4 pb-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  Documents by status
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1 tabular-nums">
                {(
                  [
                    "PENDING",
                    "QUEUED",
                    "INPROGRESS",
                    "COMPLETED",
                    "FAILED",
                  ] as const
                ).map((s) => (
                  <div key={s} className="flex justify-between">
                    <span className="text-muted-foreground">{s}</span>
                    <span>{data.database.documents[s] ?? 0}</span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>Total</span>
                  <span>{data.database.documents.total}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Chunks by status
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1 tabular-nums">
                {(
                  [
                    "PENDING",
                    "QUEUED",
                    "INPROGRESS",
                    "COMPLETED",
                    "FAILED",
                  ] as const
                ).map((s) => (
                  <div key={s} className="flex justify-between">
                    <span className="text-muted-foreground">{s}</span>
                    <span>{data.database.chunks[s] ?? 0}</span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>Total</span>
                  <span>{data.database.chunks.total}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {(data.database.chunks_orphaned ?? 0) > 0 && (
            <Card className="shadow-none border-destructive/40 bg-destructive/5">
              <CardContent className="p-3 text-sm">
                <p className="font-medium text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Orphaned chunks: {data.database.chunks_orphaned}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Chunk rows are QUEUED/INPROGRESS but no chunk-queue jobs are running.
                  Usually clears after worker-orchestrator startup recovery.
                </p>
              </CardContent>
            </Card>
          )}

          <div>
            <h4 className="text-sm font-medium mb-2">Embedding backlog (PENDING / FAILED)</h4>
            <div className="grid gap-2 sm:grid-cols-3">
              {(["entities", "relations", "chunks"] as const).map((kind) => {
                const v = data.database.vectors[kind];
                return (
                  <Card key={kind} className="shadow-none">
                    <CardContent className="p-3 text-sm">
                      <p className="capitalize font-medium mb-2">{kind}</p>
                      <div className="space-y-1 tabular-nums text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Pending</span>
                          <span>{v.pending}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Failed</span>
                          <span
                            className={v.failed > 0 ? "text-destructive" : ""}
                          >
                            {v.failed}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Completed</span>
                          <span>{v.completed}</span>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span>Total</span>
                          <span>{v.total}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="pipelines" className="mt-3 focus-visible:outline-none">
        <ScrollArea className={cn(scrollHeight, "pr-3")}>
          <div className="space-y-4 pb-4">
          {data.active_pipelines.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Workflow className="h-4 w-4" />
                Active pipelines
              </h4>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Workspace</TableHead>
                      <TableHead>Lock</TableHead>
                      <TableHead>TTL</TableHead>
                      <TableHead className="text-right">Orchestrator jobs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.active_pipelines.map((p) => (
                      <TableRow key={p.workspace}>
                        <TableCell className="font-medium">{p.workspace}</TableCell>
                        <TableCell>
                          {p.lock_held ? (
                            <Badge className="font-normal">held</Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>{formatTtl(p.lock_ttl_seconds)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.orchestrator_jobs.length}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {data.active_pipelines.some(
                (p) => p.orchestrator_jobs.length > 0
              ) && (
                <div className="mt-4 space-y-3">
                  {data.active_pipelines
                    .filter((p) => p.orchestrator_jobs.length > 0)
                    .map((p) => (
                      <div key={p.workspace}>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          {p.workspace} orchestrator jobs
                        </p>
                        <div className="rounded-md border overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Job</TableHead>
                                <TableHead>Function</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Args</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {p.orchestrator_jobs.map((job) => (
                                <TableRow key={job.id}>
                                  <TableCell className="font-mono text-xs">
                                    {job.id}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {job.function}
                                  </TableCell>
                                  <TableCell>{job.status}</TableCell>
                                  <TableCell className="text-xs">
                                    {formatArgsSummary(job.args_summary)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Redis pipeline locks
            </h4>
            {data.redis.pipeline_locks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pipeline locks held.</p>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Workspace</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead>TTL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.redis.pipeline_locks.map((lock) => (
                      <TableRow key={lock.key}>
                        <TableCell className="font-medium">
                          {lock.workspace}
                        </TableCell>
                        <TableCell className="font-mono text-xs break-all">
                          {lock.key}
                        </TableCell>
                        <TableCell>{formatTtl(lock.ttl_seconds)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {data.active_pipelines.length === 0 &&
            data.redis.pipeline_locks.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No active pipelines or locks.
              </p>
            )}
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
};

export default PreprocessQueueStatusDetail;
