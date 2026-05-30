"use client";

import {
  Activity,
  AlertTriangle,
  Database,
  HardDrive,
  Layers,
  Lock,
  Server,
  Workflow,
} from "lucide-react";
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
  formatArgsSummary,
  formatTimestamp,
  formatTtl,
  orderedQueueNames,
  queueActivityTotal,
} from "@/components/workspace/preprocessQueueStatusUtils";

interface PreprocessQueueStatusDetailProps {
  data: PreprocessQueueStatusResponse;
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
  const isReady = phase === "ready";
  return (
    <Badge
      variant={isFailed ? "destructive" : isReady ? "default" : "secondary"}
      className={cn(
        "font-normal capitalize",
        isReady && "bg-green-600 hover:bg-green-600"
      )}
    >
      {phase.replace(/_/g, " ")}
    </Badge>
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

          {isGlobal &&
            (data.database.workspaces_incomplete?.length ?? 0) > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Workspaces not ready</h4>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Workspace</TableHead>
                        <TableHead>Phase</TableHead>
                        <TableHead className="text-right">Documents</TableHead>
                        <TableHead className="text-right">Failed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.database.workspaces_incomplete!.map((row) => (
                        <TableRow key={row.workspace}>
                          <TableCell className="font-medium">
                            {row.workspace}
                          </TableCell>
                          <TableCell>
                            <PhaseBadge phase={row.phase} />
                          </TableCell>
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
                </div>
              </div>
            )}
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
