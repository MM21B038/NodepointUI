import {
  getPreprocessWorkspacesSummary,
  getWorkspacePreprocessStatus,
  PREPROCESS_QUEUE_DISPLAY_ORDER,
  type PreprocessPhase,
  type PreprocessQueueJob,
  type PreprocessQueueStatusResponse,
  type PreprocessWorkspaceIncomplete,
  type WorkspacePreprocessStatusResponse,
} from "@/database/workspaceStorage";

/** Phases treated as fully done (excluded from in-progress overview). */
export function isWorkspaceReadyPhase(phase: PreprocessPhase | string): boolean {
  return phase === "ready" || phase === "kg_ready";
}

const PHASE_OVERVIEW_ORDER: PreprocessPhase[] = [
  "failed",
  "needs_prepare",
  "queued",
  "processing",
  "embedding",
  "idle",
];

export function formatPreprocessPhaseLabel(phase: PreprocessPhase | string): string {
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
      return String(phase).replace(/_/g, " ");
  }
}

function phaseOverviewRank(phase: PreprocessPhase | string): number {
  const idx = PHASE_OVERVIEW_ORDER.indexOf(phase as PreprocessPhase);
  return idx >= 0 ? idx : PHASE_OVERVIEW_ORDER.length;
}

function mergePhase(
  existing: PreprocessPhase | undefined,
  next: PreprocessPhase
): PreprocessPhase {
  if (!existing) return next;
  return phaseOverviewRank(existing) <= phaseOverviewRank(next) ? existing : next;
}

function workspaceFromJobArgs(
  args: Record<string, string | number | null>
): string | null {
  for (const key of ["workspace", "workspace_name"]) {
    const v = args[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

const ORCHESTRATOR_QUEUE_NAMES = new Set(["orchestrator", "high", "low"]);

function phaseFromQueueJob(
  queueName: string,
  job: PreprocessQueueJob
): PreprocessPhase {
  if (job.status === "failed") return "failed";
  if (queueName === "chunk") return "processing";
  if (queueName === "vector") return "embedding";
  if (ORCHESTRATOR_QUEUE_NAMES.has(queueName)) return "queued";
  return "processing";
}

function mergeWorkspaceRow(
  existing: PreprocessWorkspaceIncomplete | undefined,
  patch: Partial<PreprocessWorkspaceIncomplete> & {
    workspace: string;
    phase?: PreprocessPhase;
  }
): PreprocessWorkspaceIncomplete {
  const phase = patch.phase
    ? mergePhase(existing?.phase, patch.phase)
    : (existing?.phase ?? "processing");
  return {
    workspace: patch.workspace,
    phase,
    documents_total: patch.documents_total ?? existing?.documents_total ?? 0,
    documents_failed: patch.documents_failed ?? existing?.documents_failed ?? 0,
    chunks_orphaned: patch.chunks_orphaned ?? existing?.chunks_orphaned,
    pipeline_active: patch.pipeline_active ?? existing?.pipeline_active,
    lock_held: patch.lock_held ?? existing?.lock_held,
    orchestrator_jobs: patch.orchestrator_jobs ?? existing?.orchestrator_jobs,
  };
}

function finalizeWorkspaceRow(
  row: PreprocessWorkspaceIncomplete
): PreprocessWorkspaceIncomplete | null {
  const active = row.pipeline_active || row.lock_held;
  if (isWorkspaceReadyPhase(row.phase) && !active) return null;
  if (isWorkspaceReadyPhase(row.phase) && active) {
    return { ...row, phase: "processing" };
  }
  return row;
}

function sortWorkspacesInProgress(
  rows: PreprocessWorkspaceIncomplete[]
): PreprocessWorkspaceIncomplete[] {
  return rows.sort(
    (a, b) =>
      phaseOverviewRank(a.phase) - phaseOverviewRank(b.phase) ||
      a.workspace.localeCompare(b.workspace)
  );
}

/** Sync: merge API incomplete list, pipelines, locks, and RQ job workspace args. */
export function buildWorkspacesInProgressSnapshot(
  data: PreprocessQueueStatusResponse
): PreprocessWorkspaceIncomplete[] {
  const map = new Map<string, PreprocessWorkspaceIncomplete>();

  const upsert = (
    patch: Partial<PreprocessWorkspaceIncomplete> & {
      workspace: string;
      phase?: PreprocessPhase;
    }
  ) => {
    const name = patch.workspace;
    map.set(name, mergeWorkspaceRow(map.get(name), patch));
  };

  for (const row of data.database.workspaces_incomplete ?? []) {
    upsert(row);
  }

  for (const pipeline of data.active_pipelines) {
    upsert({
      workspace: pipeline.workspace,
      pipeline_active: true,
      lock_held: pipeline.lock_held,
      orchestrator_jobs: pipeline.orchestrator_jobs.length,
      phase: "processing",
    });
  }

  for (const lock of data.redis.pipeline_locks) {
    upsert({
      workspace: lock.workspace,
      lock_held: true,
      phase: "processing",
    });
  }

  for (const queueName of orderedQueueNames(data.rq.queues)) {
    const queue = data.rq.queues[queueName];
    if (!queue) continue;
    const jobs: PreprocessQueueJob[] = [
      ...queue.jobs,
      ...queue.failed_sample,
    ];
    for (const job of jobs) {
      const ws = workspaceFromJobArgs(job.args_summary);
      if (!ws) continue;
      upsert({
        workspace: ws,
        phase: phaseFromQueueJob(queueName, job),
      });
    }
  }

  const rows: PreprocessWorkspaceIncomplete[] = [];
  for (const row of map.values()) {
    const finalized = finalizeWorkspaceRow(row);
    if (finalized) rows.push(finalized);
  }
  return sortWorkspacesInProgress(rows);
}

/** @deprecated alias */
export function getWorkspacesInProgress(
  data: PreprocessQueueStatusResponse
): PreprocessWorkspaceIncomplete[] {
  return buildWorkspacesInProgressSnapshot(data);
}

const STATUS_RESOLVE_BATCH = 8;

function workspaceHasPreprocessActivity(
  status: WorkspacePreprocessStatusResponse
): boolean {
  if (!status.overall.ready) return true;
  if (!isWorkspaceReadyPhase(status.overall.phase)) return true;

  const vectors = status.vectors;
  const vectorBacklog =
    vectors.entities.pending +
    vectors.relations.pending +
    vectors.chunks.pending +
    vectors.entities.failed +
    vectors.relations.failed +
    vectors.chunks.failed;
  if (vectorBacklog > 0) return true;

  const byStatus = status.documents.by_status;
  if (
    (byStatus.FAILED ?? 0) > 0 ||
    (byStatus.INPROGRESS ?? 0) > 0 ||
    (byStatus.QUEUED ?? 0) > 0 ||
    (byStatus.PENDING ?? 0) > 0
  ) {
    return true;
  }

  return status.files.some(
    (file) =>
      !isWorkspaceReadyPhase(file.phase) ||
      file.chunks.queued > 0 ||
      file.chunks.in_progress > 0 ||
      file.chunks.failed > 0
  );
}

function derivePhaseFromPreprocessStatus(
  status: WorkspacePreprocessStatusResponse
): PreprocessPhase {
  if (!isWorkspaceReadyPhase(status.overall.phase)) {
    return status.overall.phase;
  }

  let phase: PreprocessPhase | undefined;
  for (const file of status.files) {
    if (isWorkspaceReadyPhase(file.phase)) continue;
    phase = mergePhase(phase, file.phase);
  }
  if (phase) return phase;

  const vectors = status.vectors;
  const pending =
    vectors.entities.pending +
    vectors.relations.pending +
    vectors.chunks.pending;
  const failed =
    vectors.entities.failed +
    vectors.relations.failed +
    vectors.chunks.failed;
  if (failed > 0) return "failed";
  if (pending > 0) return "embedding";

  return status.overall.phase;
}

/** Per-workspace file counts by preprocess phase (from preprocess-status). */
export interface WorkspacePreprocessTableRow {
  workspace: string;
  overallPhase: PreprocessPhase;
  totalFiles: number;
  needsPrepare: number;
  queued: number;
  processing: number;
  embedding: number;
  failed: number;
  ready: number;
}

export function summarizeWorkspacePreprocessStatus(
  status: WorkspacePreprocessStatusResponse
): WorkspacePreprocessTableRow {
  let needsPrepare = 0;
  let queued = 0;
  let processing = 0;
  let embedding = 0;
  let failed = 0;
  let ready = 0;

  for (const file of status.files) {
    switch (file.phase) {
      case "needs_prepare":
        needsPrepare += 1;
        break;
      case "queued":
        queued += 1;
        break;
      case "processing":
        processing += 1;
        break;
      case "embedding":
        embedding += 1;
        break;
      case "failed":
        failed += 1;
        break;
      case "kg_ready":
      case "ready":
        ready += 1;
        break;
      default:
        break;
    }
  }

  const totalFiles =
    status.files.length > 0
      ? status.files.length
      : status.overall.documents_total;

  return {
    workspace: status.workspace,
    overallPhase: status.overall.phase,
    totalFiles,
    needsPrepare,
    queued,
    processing,
    embedding,
    failed,
    ready,
  };
}

function sortWorkspaceTableRows(
  rows: WorkspacePreprocessTableRow[]
): WorkspacePreprocessTableRow[] {
  return rows.sort(
    (a, b) =>
      phaseOverviewRank(a.overallPhase) - phaseOverviewRank(b.overallPhase) ||
      a.workspace.localeCompare(b.workspace)
  );
}

/** True when workspace preprocess is not fully ready (API flag or any file not ready). */
export function isWorkspaceNotReadyForTable(
  status: WorkspacePreprocessStatusResponse
): boolean {
  if (!status.overall.ready) return true;
  return status.files.some((file) => !isWorkspaceReadyPhase(file.phase));
}

export function isWorkspaceTableRowNotReady(
  row: WorkspacePreprocessTableRow
): boolean {
  if (!isWorkspaceReadyPhase(row.overallPhase) && row.overallPhase !== "idle") {
    return true;
  }
  const active =
    row.needsPrepare +
    row.queued +
    row.processing +
    row.embedding +
    row.failed;
  return active > 0 || row.ready < row.totalFiles;
}

function sortAllWorkspaceTableRows(
  rows: WorkspacePreprocessTableRow[]
): WorkspacePreprocessTableRow[] {
  return rows.sort((a, b) => {
    const aBusy = isWorkspaceTableRowNotReady(a);
    const bBusy = isWorkspaceTableRowNotReady(b);
    if (aBusy !== bBusy) return aBusy ? -1 : 1;
    const phaseDiff =
      phaseOverviewRank(a.overallPhase) - phaseOverviewRank(b.overallPhase);
    if (phaseDiff !== 0) return phaseDiff;
    return a.workspace.localeCompare(b.workspace);
  });
}

function tableRowFromSummaryOnly(
  ws: PreprocessWorkspaceIncomplete
): WorkspacePreprocessTableRow {
  return {
    workspace: ws.workspace,
    overallPhase: ws.phase,
    totalFiles: ws.documents_total,
    needsPrepare: 0,
    queued: 0,
    processing: 0,
    embedding: 0,
    failed: ws.documents_failed,
    ready: 0,
  };
}

/**
 * Fast path: workspaces-summary (one request), then preprocess-status only for
 * not-ready workspaces (typically few) for per-file phase counts.
 */
export async function fetchWorkspacePreprocessTableRows(
  signal?: AbortSignal
): Promise<WorkspacePreprocessTableRow[]> {
  const summary = await getPreprocessWorkspacesSummary();
  if (signal?.aborted) return [];

  const candidates = summary.workspaces;
  if (candidates.length === 0) return [];

  const byWorkspace = new Map<string, WorkspacePreprocessTableRow>();

  for (let i = 0; i < candidates.length; i += STATUS_RESOLVE_BATCH) {
    if (signal?.aborted) break;
    const batch = candidates.slice(i, i + STATUS_RESOLVE_BATCH);
    const statuses = await Promise.all(
      batch.map(async (ws) => {
        try {
          return await getWorkspacePreprocessStatus(ws.workspace);
        } catch {
          return null;
        }
      })
    );
    for (let j = 0; j < batch.length; j++) {
      const status = statuses[j];
      const fallback = batch[j];
      if (status) {
        byWorkspace.set(
          status.workspace,
          summarizeWorkspacePreprocessStatus(status)
        );
      } else if (fallback) {
        byWorkspace.set(fallback.workspace, tableRowFromSummaryOnly(fallback));
      }
    }
  }

  return sortAllWorkspaceTableRows(Array.from(byWorkspace.values()));
}

/** Fallback: queue-status snapshot, then workspaces-summary (no full workspace scan). */
export async function resolveWorkspacesInProgress(
  data: PreprocessQueueStatusResponse,
  signal?: AbortSignal
): Promise<PreprocessWorkspaceIncomplete[]> {
  const fromSnapshot = buildWorkspacesInProgressSnapshot(data);
  if (fromSnapshot.length > 0) return fromSnapshot;
  if (!hasPreprocessSystemActivity(data)) return [];

  const summary = await getPreprocessWorkspacesSummary();
  if (signal?.aborted) return [];
  return summary.workspaces;
}

export function hasPreprocessSystemActivity(
  data: PreprocessQueueStatusResponse
): boolean {
  return shouldPollPreprocessStatus(data);
}

export function hasUnattributedPreprocessActivity(
  data: PreprocessQueueStatusResponse,
  resolvedCount: number
): boolean {
  return resolvedCount === 0 && hasPreprocessSystemActivity(data);
}

/** Queue depths when workspace names could not be resolved. */
export function getActiveQueueBreakdown(
  data: PreprocessQueueStatusResponse
): { queue: string; queued: number; started: number; failed: number }[] {
  const out: { queue: string; queued: number; started: number; failed: number }[] =
    [];
  for (const name of orderedQueueNames(data.rq.queues)) {
    const c = data.rq.queues[name]?.counts;
    if (!c) continue;
    const active = c.queued + c.started + c.failed;
    if (active > 0) {
      out.push({
        queue: name,
        queued: c.queued,
        started: c.started,
        failed: c.failed,
      });
    }
  }
  return out;
}

export interface WorkspacesByPhaseGroup {
  phase: PreprocessPhase | string;
  label: string;
  workspaces: PreprocessWorkspaceIncomplete[];
}

export function groupWorkspacesByPhase(
  workspaces: PreprocessWorkspaceIncomplete[]
): WorkspacesByPhaseGroup[] {
  const byPhase = new Map<string, PreprocessWorkspaceIncomplete[]>();
  for (const row of workspaces) {
    const key = row.phase;
    const list = byPhase.get(key) ?? [];
    list.push(row);
    byPhase.set(key, list);
  }

  return Array.from(byPhase.entries())
    .sort(([a], [b]) => phaseOverviewRank(a) - phaseOverviewRank(b))
    .map(([phase, list]) => ({
      phase,
      label: formatPreprocessPhaseLabel(phase),
      workspaces: list.sort((a, b) => a.workspace.localeCompare(b.workspace)),
    }));
}

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
  if ((data.database.chunks_orphaned ?? 0) > 0) return true;
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
    chunksOrphaned: data.database.chunks_orphaned ?? 0,
  };
}
