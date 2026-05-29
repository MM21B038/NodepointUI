"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getPreprocessQueueStatus,
  PREPROCESS_QUEUE_DISPLAY_ORDER,
  type PreprocessQueueStatusResponse,
} from "@/database/workspaceStorage";
import { cn } from "@/lib/utils";

const POLL_MS = 5000;

function orderedQueueNames(
  queues: PreprocessQueueStatusResponse["rq"]["queues"]
): string[] {
  const keys = Object.keys(queues);
  const ordered = PREPROCESS_QUEUE_DISPLAY_ORDER.filter((name) =>
    keys.includes(name)
  );
  for (const name of keys) {
    if (!ordered.includes(name)) ordered.push(name);
  }
  return ordered;
}

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function formatTtl(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function queueActivityTotal(data: PreprocessQueueStatusResponse): number {
  let n = 0;
  for (const name of orderedQueueNames(data.rq.queues)) {
    const c = data.rq.queues[name]?.counts;
    if (c) n += c.queued + c.started + c.failed;
  }
  return n;
}

function shouldPoll(data: PreprocessQueueStatusResponse | null): boolean {
  if (!data) return true;
  if (queueActivityTotal(data) > 0) return true;
  if (data.redis.pipeline_locks.length > 0) return true;
  if ((data.database.workspaces_incomplete?.length ?? 0) > 0) return true;
  if (data.active_pipelines.length > 0) return true;
  const vectors = data.database.vectors;
  const vectorPending =
    vectors.entities.pending +
    vectors.relations.pending +
    vectors.chunks.pending;
  const vectorFailed =
    vectors.entities.failed + vectors.relations.failed + vectors.chunks.failed;
  if (vectorPending + vectorFailed > 0) return true;
  const docs = data.database.documents;
  const chunks = data.database.chunks;
  const docBacklog =
    (docs.PENDING ?? 0) +
    (docs.QUEUED ?? 0) +
    (docs.INPROGRESS ?? 0) +
    (docs.FAILED ?? 0);
  const chunkBacklog =
    (chunks.PENDING ?? 0) +
    (chunks.QUEUED ?? 0) +
    (chunks.INPROGRESS ?? 0) +
    (chunks.FAILED ?? 0);
  return docBacklog + chunkBacklog > 0;
}

function formatArgsSummary(args: Record<string, string | number | null>): string {
  const parts = Object.entries(args)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}=${v}`);
  return parts.length > 0 ? parts.join(", ") : "—";
}

function QueueCountBadge({
  name,
  queued,
  started,
  failed,
}: {
  name: string;
  queued: number;
  started: number;
  failed: number;
}) {
  const active = queued + started;
  if (active === 0 && failed === 0) {
    return (
      <span className="text-xs text-muted-foreground tabular-nums">
        {name}: idle
      </span>
    );
  }
  return (
    <Badge
      variant={failed > 0 ? "destructive" : active > 0 ? "default" : "secondary"}
      className="text-xs font-normal tabular-nums"
    >
      {name}: {queued}q / {started}▶
      {failed > 0 ? ` / ${failed}✕` : ""}
    </Badge>
  );
}

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
  const [open, setOpen] = useState(false);
  const autoOpenedRef = useRef(false);

  const fetchStatus = useCallback(async (showSpinner: boolean) => {
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
  }, [workspaceName]);

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
        if (shouldPoll(snapshot) && !autoOpenedRef.current) {
          autoOpenedRef.current = true;
          setOpen(true);
        }
        if (shouldPoll(snapshot)) {
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

  const title = workspaceName
    ? `Pipeline ops — ${workspaceName}`
    : "Preprocess pipeline (global)";

  const workersBusy =
    data?.rq.workers.filter((w) => w.state === "busy").length ?? 0;
  const workerTotal = data?.rq.workers.length ?? 0;
  const incompleteCount = data?.database.workspaces_incomplete?.length ?? 0;
  const lockCount = data?.redis.pipeline_locks.length ?? 0;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn("shrink-0 border-b border-border/60 bg-muted/20", className)}
    >
      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2 -ml-2 font-medium"
          >
            {open ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <Server className="h-4 w-4 text-muted-foreground" />
            {title}
          </Button>
        </CollapsibleTrigger>

        {isLoading && !data ? (
          <Skeleton className="h-5 w-48" />
        ) : error ? (
          <span className="text-xs text-destructive">{error}</span>
        ) : data ? (
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            {orderedQueueNames(data.rq.queues).map((name) => {
              const q = data.rq.queues[name];
              if (!q) return null;
              return (
                <QueueCountBadge
                  key={name}
                  name={name}
                  queued={q.counts.queued}
                  started={q.counts.started}
                  failed={q.counts.failed}
                />
              );
            })}
            <span className="text-xs text-muted-foreground tabular-nums">
              {workersBusy}/{workerTotal} workers busy
            </span>
            {lockCount > 0 && (
              <Badge variant="outline" className="text-xs font-normal">
                {lockCount} lock{lockCount === 1 ? "" : "s"}
              </Badge>
            )}
            {!workspaceName && incompleteCount > 0 && (
              <Badge variant="secondary" className="text-xs font-normal">
                {incompleteCount} incomplete
              </Badge>
            )}
            <span className="text-xs text-muted-foreground ml-1">
              {formatTimestamp(data.generated_at)}
            </span>
          </div>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 ml-auto shrink-0"
          onClick={() => void fetchStatus(true)}
          disabled={isLoading}
          aria-label="Refresh queue status"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>

      <CollapsibleContent>
        {error && !data ? null : isLoading && !data ? (
          <div className="px-4 pb-3 space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : data ? (
          <ScrollArea className="max-h-[min(24rem,40vh)]">
            <div className="px-4 pb-3 space-y-4 text-sm">
              {!workspaceName &&
                (data.database.workspaces_incomplete?.length ?? 0) > 0 && (
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                      Workspaces incomplete
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Workspace</TableHead>
                          <TableHead>Phase</TableHead>
                          <TableHead className="text-right">Docs</TableHead>
                          <TableHead className="text-right">Failed</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.database.workspaces_incomplete!.map((row) => (
                          <TableRow key={row.workspace}>
                            <TableCell className="font-medium">
                              {row.workspace}
                            </TableCell>
                            <TableCell>{row.phase}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.documents_total}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.documents_failed}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </section>
                )}

              {data.active_pipelines.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                    Active pipelines
                  </h3>
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
                          <TableCell className="font-medium">
                            {p.workspace}
                          </TableCell>
                          <TableCell>
                            {p.lock_held ? "held" : "—"}
                          </TableCell>
                          <TableCell>{formatTtl(p.lock_ttl_seconds)}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {p.orchestrator_jobs.length}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </section>
              )}

              {data.redis.pipeline_locks.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                    Redis pipeline locks
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Workspace</TableHead>
                        <TableHead>TTL</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.redis.pipeline_locks.map((lock) => (
                        <TableRow key={lock.key}>
                          <TableCell className="font-medium">
                            {lock.workspace}
                          </TableCell>
                          <TableCell>{formatTtl(lock.ttl_seconds)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </section>
              )}

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  Database backlog
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
                  <div className="rounded-md border bg-card p-2">
                    <p className="text-muted-foreground mb-1">Documents</p>
                    <p className="tabular-nums">
                      P {(data.database.documents.PENDING ?? 0)} · Q{" "}
                      {(data.database.documents.QUEUED ?? 0)} · IP{" "}
                      {(data.database.documents.INPROGRESS ?? 0)}
                    </p>
                    <p className="tabular-nums text-muted-foreground">
                      ✓ {(data.database.documents.COMPLETED ?? 0)} / ✕{" "}
                      {(data.database.documents.FAILED ?? 0)} · total{" "}
                      {data.database.documents.total}
                    </p>
                  </div>
                  <div className="rounded-md border bg-card p-2">
                    <p className="text-muted-foreground mb-1">Chunks</p>
                    <p className="tabular-nums">
                      P {(data.database.chunks.PENDING ?? 0)} · Q{" "}
                      {(data.database.chunks.QUEUED ?? 0)} · IP{" "}
                      {(data.database.chunks.INPROGRESS ?? 0)}
                    </p>
                    <p className="tabular-nums text-muted-foreground">
                      ✓ {(data.database.chunks.COMPLETED ?? 0)} / ✕{" "}
                      {(data.database.chunks.FAILED ?? 0)} · total{" "}
                      {data.database.chunks.total}
                    </p>
                  </div>
                  {(
                    ["entities", "relations", "chunks"] as const
                  ).map((kind) => {
                    const v = data.database.vectors[kind];
                    return (
                      <div key={kind} className="rounded-md border bg-card p-2">
                        <p className="text-muted-foreground mb-1 capitalize">
                          Vectors {kind}
                        </p>
                        <p className="tabular-nums">
                          pending {v.pending} · failed {v.failed}
                        </p>
                        <p className="tabular-nums text-muted-foreground">
                          total {v.total}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              {data.rq.workers.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                    Workers
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>Queues</TableHead>
                        <TableHead>Current job</TableHead>
                        <TableHead>Heartbeat</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rq.workers.map((w) => (
                        <TableRow key={w.name}>
                          <TableCell className="font-mono text-xs">
                            {w.name}
                          </TableCell>
                          <TableCell>{w.state}</TableCell>
                          <TableCell className="text-xs">
                            {w.queues.join(", ")}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {w.current_job_id ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {formatTimestamp(w.last_heartbeat)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </section>
              )}

              {orderedQueueNames(data.rq.queues).map((queueName) => {
                const q = data.rq.queues[queueName];
                if (!q) return null;
                const hasJobs =
                  q.jobs.length > 0 || q.failed_sample.length > 0;
                if (!hasJobs && queueActivityTotal(data) === 0) return null;
                if (!hasJobs) return null;

                return (
                  <section key={queueName}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                      Queue: {queueName}
                    </h3>
                    {q.jobs.length > 0 && (
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
                          {q.jobs.map((job) => (
                            <TableRow key={job.id}>
                              <TableCell className="font-mono text-xs max-w-[8rem] truncate">
                                {job.id}
                              </TableCell>
                              <TableCell className="text-xs">
                                {job.function}
                              </TableCell>
                              <TableCell>{job.status}</TableCell>
                              <TableCell className="text-xs max-w-[14rem] truncate">
                                {formatArgsSummary(job.args_summary)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                    {q.failed_sample.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-destructive font-medium">
                          Failed sample
                        </p>
                        {q.failed_sample.map((job) => (
                          <div
                            key={job.id}
                            className="rounded border border-destructive/30 bg-destructive/5 p-2 text-xs"
                          >
                            <p className="font-mono truncate">{job.id}</p>
                            <p>
                              {job.function} — {formatArgsSummary(job.args_summary)}
                            </p>
                            <p className="text-destructive/90 mt-1 whitespace-pre-wrap break-words">
                              {job.error}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </ScrollArea>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default PreprocessQueueStatusPanel;
