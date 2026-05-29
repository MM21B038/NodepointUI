import {
  PREPROCESS_QUEUE_DISPLAY_ORDER,
  type PreprocessQueueStatusResponse,
} from "@/database/workspaceStorage";

export const PREPROCESS_POLL_MS = 5000;

export function orderedQueueNames(
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

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function formatTtl(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function formatArgsSummary(
  args: Record<string, string | number | null>
): string {
  const parts = Object.entries(args)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}=${v}`);
  return parts.length > 0 ? parts.join(", ") : "—";
}

export function queueActivityTotal(data: PreprocessQueueStatusResponse): number {
  let n = 0;
  for (const name of orderedQueueNames(data.rq.queues)) {
    const c = data.rq.queues[name]?.counts;
    if (c) n += c.queued + c.started + c.failed;
  }
  return n;
}

export function hasPreprocessActivity(
  data: PreprocessQueueStatusResponse | null
): boolean {
  if (!data) return false;
  return shouldPollPreprocessStatus(data);
}

export function shouldPollPreprocessStatus(
  data: PreprocessQueueStatusResponse | null
): boolean {
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

export function computePreprocessSummary(data: PreprocessQueueStatusResponse) {
  const queueNames = orderedQueueNames(data.rq.queues);
  let queued = 0;
  let started = 0;
  let failed = 0;
  for (const name of queueNames) {
    const c = data.rq.queues[name]?.counts;
    if (!c) continue;
    queued += c.queued;
    started += c.started;
    failed += c.failed;
  }
  const workersBusy = data.rq.workers.filter((w) => w.state === "busy").length;
  const vectors = data.database.vectors;
  const vectorBacklog =
    vectors.entities.pending +
    vectors.relations.pending +
    vectors.chunks.pending +
    vectors.entities.failed +
    vectors.relations.failed +
    vectors.chunks.failed;
  return {
    queued,
    started,
    failed,
    workersBusy,
    workerTotal: data.rq.workers.length,
    lockCount: data.redis.pipeline_locks.length,
    incompleteCount: data.database.workspaces_incomplete?.length ?? 0,
    activePipelineCount: data.active_pipelines.length,
    vectorBacklog,
    docTotal: data.database.documents.total,
    chunkTotal: data.database.chunks.total,
  };
}
