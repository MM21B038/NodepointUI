import { API_ROOT, buildApiUrl } from "@/database/apiUrl";

export { API_ROOT };

async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return data.error || data.detail || data.message || response.statusText;
  } catch {
    return response.statusText;
  }
}

// --- Workspace ---

/** System group synced with `is_flag` on workspaces (alias: legacy `flagged=true` scope). */
export const FLAGGED_GROUP_NAME = "flagged";

/** Exactly one of workspace or group scope for KG, entity search, entity-types, chat summary. */
export type KgApiScope = { workspaceName: string } | { group: string };

export function isGroupScope(scope: KgApiScope): scope is { group: string } {
  return "group" in scope;
}

export function groupScope(groupName: string): KgApiScope {
  return { group: groupName };
}

/** @deprecated Use groupScope(activeGroup) */
export function flaggedGroupScope(): KgApiScope {
  return { group: FLAGGED_GROUP_NAME };
}

export async function listSelectableGroups(): Promise<WorkspaceGroupSummary[]> {
  const all = await listWorkspaceGroups();
  return all.filter(
    (g) => g.name !== FLAGGED_GROUP_NAME && !g.is_system
  );
}

export async function getGroupMemberNames(groupName: string): Promise<string[]> {
  const detail = await getGroup(groupName);
  return detail.workspaces.map((w) => w.name).sort((a, b) => a.localeCompare(b));
}

export function scopeToQueryParams(scope: KgApiScope): Record<string, string> {
  if (isGroupScope(scope)) return { group: scope.group };
  return { workspace_name: scope.workspaceName };
}

export interface WorkspaceEntry {
  name: string;
  is_flag: boolean;
  groups?: string[];
  created_at: string;
}

export async function getWorkspaces(): Promise<WorkspaceEntry[]> {
  try {
    const response = await fetch(`${API_ROOT}/workspace/list/`);
    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }
    const data: WorkspaceEntry[] = await response.json();
    return (data || []).map((ws) => {
      const groups = Array.isArray(ws.groups) ? ws.groups : [];
      return {
        ...ws,
        is_flag: Boolean(ws.is_flag) || groups.includes(FLAGGED_GROUP_NAME),
        groups,
      };
    });
  } catch (error) {
    console.error("Error fetching workspaces:", error);
    return [];
  }
}

export interface WorkspaceStats {
  total: number;
  /** @deprecated Prefer in_group / ungrouped when present */
  flagged?: number;
  /** @deprecated Prefer in_group / ungrouped when present */
  non_flagged?: number;
  in_group?: number;
  ungrouped?: number;
}

export interface WorkspaceCounts {
  files: number;
  chunks: number;
  entities: number;
  relations: number;
}

export interface WorkspacePageItem {
  name: string;
  is_flag: boolean;
  created_at: string;
  counts: WorkspaceCounts;
  groups?: string[];
}

export interface WorkspacePagePagination {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface WorkspacePageResponse {
  filter: string;
  pagination: WorkspacePagePagination;
  workspaces: WorkspacePageItem[];
}

export type WorkspacePageFlag = "all" | "flagged" | "non_flagged";

function normalizeWorkspaceCounts(raw: Partial<WorkspaceCounts> | undefined): WorkspaceCounts {
  return {
    files: raw?.files ?? 0,
    chunks: raw?.chunks ?? 0,
    entities: raw?.entities ?? 0,
    relations: raw?.relations ?? 0,
  };
}

function normalizeWorkspacePageItem(raw: WorkspacePageItem): WorkspacePageItem {
  return {
    name: raw.name,
    is_flag: Boolean(raw.is_flag),
    created_at: raw.created_at,
    counts: normalizeWorkspaceCounts(raw.counts),
    groups: Array.isArray(raw.groups) ? raw.groups : undefined,
  };
}

export async function getWorkspaceStats(): Promise<WorkspaceStats> {
  const response = await fetch(buildApiUrl("/workspace/stats/"));
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  const data = await response.json();
  return {
    total: data.total ?? 0,
    flagged: data.flagged,
    non_flagged: data.non_flagged,
    in_group: data.in_group,
    ungrouped: data.ungrouped,
  };
}

export async function getWorkspacePage(params: {
  page?: number;
  page_size?: number;
  flag?: WorkspacePageFlag;
  signal?: AbortSignal;
}): Promise<WorkspacePageResponse> {
  const query: Record<string, string> = {};
  if (params.page !== undefined) query.page = String(params.page);
  if (params.page_size !== undefined) query.page_size = String(params.page_size);
  if (params.flag !== undefined) query.flag = params.flag;

  const response = await fetch(buildApiUrl("/workspace/page/", query), {
    signal: params.signal,
  });
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  const data: WorkspacePageResponse = await response.json();
  return {
    filter: data.filter ?? params.flag ?? "all",
    pagination: {
      page: data.pagination?.page ?? 1,
      page_size: data.pagination?.page_size ?? params.page_size ?? 20,
      total_items: data.pagination?.total_items ?? 0,
      total_pages: data.pagination?.total_pages ?? 0,
      has_next: Boolean(data.pagination?.has_next),
      has_previous: Boolean(data.pagination?.has_previous),
    },
    workspaces: (data.workspaces ?? []).map(normalizeWorkspacePageItem),
  };
}

export class WorkspaceCreateError extends Error {
  constructor(
    message: string,
    readonly code: "empty" | "exists" | "network" | "api"
  ) {
    super(message);
    this.name = "WorkspaceCreateError";
  }
}

export async function createWorkspace(name: string): Promise<void> {
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new WorkspaceCreateError("Workspace name cannot be empty.", "empty");
  }

  let response: Response;
  try {
    response = await fetch(`${API_ROOT}/workspace/create/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: normalizedName }),
    });
  } catch (error) {
    const hint =
      "Could not reach the API. Is the backend running on port 8000? Restart `npm run dev` after pulling latest changes (Vite proxy).";
    console.error("Error creating workspace:", error);
    throw new WorkspaceCreateError(
      error instanceof Error ? `${error.message}. ${hint}` : hint,
      "network"
    );
  }

  if (response.ok) return;

  const message = await parseErrorResponse(response);
  if (response.status === 400 && message.toLowerCase().includes("exist")) {
    throw new WorkspaceCreateError(
      `Workspace "${normalizedName}" already exists.`,
      "exists"
    );
  }
  throw new WorkspaceCreateError(message, "api");
}

export async function deleteWorkspace(workspaceName: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${API_ROOT}/workspace/delete/${encodeURIComponent(workspaceName)}/`,
      { method: "DELETE" }
    );
    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }
    return true;
  } catch (error) {
    console.error(`Error deleting workspace ${workspaceName}:`, error);
    throw error;
  }
}

export interface FlagStatusResponse {
  workspace: string;
  is_flag: boolean;
}

export async function getFlagStatus(workspaceName: string): Promise<FlagStatusResponse> {
  try {
    const response = await fetch(
      `${API_ROOT}/workspace/${encodeURIComponent(workspaceName)}/flag-status/`
    );
    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }
    return response.json();
  } catch (error) {
    console.error(`Error fetching flag status for ${workspaceName}:`, error);
    return { workspace: workspaceName, is_flag: false };
  }
}

export interface ToggleFlagResponse {
  message: string;
  workspace: string;
  is_flag: boolean;
}

export async function toggleWorkspaceFlag(
  workspaceName: string
): Promise<ToggleFlagResponse> {
  const response = await fetch(
    `${API_ROOT}/workspace/${encodeURIComponent(workspaceName)}/toggle-flag/`,
    { method: "PATCH" }
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return response.json();
}

/** @deprecated Use toggleWorkspaceFlag */
export async function flagWorkspace(workspaceName: string): Promise<{ flag: boolean; message: string }> {
  const status = await getFlagStatus(workspaceName);
  if (status.is_flag) {
    return { flag: true, message: "Workspace is already flagged" };
  }
  const result = await toggleWorkspaceFlag(workspaceName);
  return { flag: result.is_flag, message: result.message };
}

/** @deprecated Use toggleWorkspaceFlag */
export async function undoFlagWorkspace(workspaceName: string): Promise<{ flag: boolean; message: string }> {
  const status = await getFlagStatus(workspaceName);
  if (!status.is_flag) {
    return { flag: false, message: "Workspace is not flagged" };
  }
  const result = await toggleWorkspaceFlag(workspaceName);
  return { flag: result.is_flag, message: result.message };
}

export interface FlaggedWorkspaceCountResponse {
  count: number;
  workspaces: string[];
}

export async function getFlaggedWorkspaceCount(): Promise<FlaggedWorkspaceCountResponse> {
  try {
    const detail = await getGroup(FLAGGED_GROUP_NAME);
    const workspaces = detail.workspaces.map((w) => w.name).sort((a, b) => a.localeCompare(b));
    return { count: workspaces.length, workspaces };
  } catch (err) {
    console.warn("getFlaggedWorkspaceCount: group endpoint unavailable, trying legacy count", err);
  }

  try {
    const response = await fetch(buildApiUrl("/workspace/flagged/count/"));
    if (response.ok) {
      const data = await response.json();
      return {
        count: typeof data.count === "number" ? data.count : 0,
        workspaces: Array.isArray(data.workspaces) ? data.workspaces : [],
      };
    }
  } catch (err) {
    console.warn("getFlaggedWorkspaceCount: legacy endpoint unavailable, using list fallback", err);
  }

  const workspaces = (await getWorkspaces())
    .filter((ws) => ws.is_flag)
    .map((ws) => ws.name)
    .sort((a, b) => a.localeCompare(b));
  return { count: workspaces.length, workspaces };
}

// --- Workspace groups ---

export interface WorkspaceGroupSummary {
  name: string;
  workspace_count: number;
  created_at: string;
  is_system?: boolean;
}

export interface WorkspaceGroupMember {
  name: string;
  is_flag: boolean;
  created_at: string;
}

export interface WorkspaceGroupDetail {
  name: string;
  workspace_count: number;
  is_system?: boolean;
  workspaces: WorkspaceGroupMember[];
}

export async function createWorkspaceGroup(name: string): Promise<WorkspaceGroupSummary> {
  const normalized = name.trim();
  const response = await fetch(buildApiUrl("/group/create/"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: normalized }),
  });
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  const data = await response.json();
  return data.group as WorkspaceGroupSummary;
}

export async function listWorkspaceGroups(): Promise<WorkspaceGroupSummary[]> {
  const response = await fetch(buildApiUrl("/group/list/"));
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  const data = await response.json();
  return (data.groups ?? []) as WorkspaceGroupSummary[];
}

export async function getGroup(groupName: string): Promise<WorkspaceGroupDetail> {
  const response = await fetch(
    buildApiUrl(`/group/${encodeURIComponent(groupName)}/`)
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  const data = await response.json();
  return {
    name: data.name,
    workspace_count: data.workspace_count ?? data.workspaces?.length ?? 0,
    is_system: Boolean(data.is_system),
    workspaces: (data.workspaces ?? []).map((w: WorkspaceGroupMember) => ({
      name: w.name,
      is_flag: Boolean(w.is_flag),
      created_at: w.created_at,
    })),
  };
}

export async function deleteWorkspaceGroup(groupName: string): Promise<void> {
  const response = await fetch(
    buildApiUrl(`/group/${encodeURIComponent(groupName)}/`),
    { method: "DELETE" }
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
}

export async function addWorkspaceToGroup(
  groupName: string,
  workspaceName: string
): Promise<void> {
  const response = await fetch(
    buildApiUrl(`/group/${encodeURIComponent(groupName)}/workspaces/`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_name: workspaceName }),
    }
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
}

export async function removeWorkspaceFromGroup(
  groupName: string,
  workspaceName: string
): Promise<void> {
  const response = await fetch(
    buildApiUrl(
      `/group/${encodeURIComponent(groupName)}/workspaces/${encodeURIComponent(workspaceName)}/`
    ),
    { method: "DELETE" }
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
}

export async function getGroupWorkspaceNames(groupName: string): Promise<string[]> {
  const detail = await getGroup(groupName);
  return detail.workspaces.map((w) => w.name).sort((a, b) => a.localeCompare(b));
}

// --- Documents ---

export type DocumentStatus =
  | "PENDING"
  | "QUEUED"
  | "INPROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "TERMINATED"
  | "INVALID";

export interface DocumentEntry {
  id: string;
  file_name: string;
  file_url: string;
  status: DocumentStatus;
  content: boolean;
  uploaded_at: string;
}

export interface DocumentListResponse {
  workspace: string;
  total_files: number;
  files: DocumentEntry[];
}

export async function listDocuments(workspaceName: string): Promise<DocumentListResponse> {
  try {
    const response = await fetch(
      `${API_ROOT}/document/${encodeURIComponent(workspaceName)}/`
    );
    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }
    return response.json();
  } catch (error) {
    console.error(`Error fetching documents for ${workspaceName}:`, error);
    return { workspace: workspaceName, total_files: 0, files: [] };
  }
}

export async function listFiles(workspaceName: string): Promise<string[]> {
  const data = await listDocuments(workspaceName);
  return data.files.map((f) => f.file_name);
}

export interface UploadFileResponse {
  message: string;
  id: string;
  file_name: string;
  file_path: string;
  file_url: string;
  status: DocumentStatus;
}

export async function uploadFile(
  workspaceName: string,
  file: File
): Promise<UploadFileResponse> {
  const formData = new FormData();
  formData.append("workspace_name", workspaceName);
  formData.append("file", file);

  const response = await fetch(`${API_ROOT}/document/upload/`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return response.json();
}

export async function deleteFile(
  workspaceName: string,
  fileName: string
): Promise<boolean> {
  const response = await fetch(
    `${API_ROOT}/document/delete/${encodeURIComponent(workspaceName)}/${encodeURIComponent(fileName)}/`,
    { method: "DELETE" }
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return true;
}

// --- Preprocess ---

export async function startPreprocess(workspaceName: string): Promise<{ message: string }> {
  const response = await fetch(
    `${API_ROOT}/workspace/preprocess/${encodeURIComponent(workspaceName)}/`,
    { method: "POST" }
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return response.json();
}

export type PreprocessPhase =
  | "idle"
  | "queued"
  | "processing"
  | "embedding"
  | "ready"
  | "failed"
  | "kg_ready";

/** Entity / relation / chunk vector job counts (Qdrant pipeline). */
export interface VectorPipelineCounts {
  total: number;
  pending: number;
  completed: number;
  failed: number;
}

/** Per-file chunk KG pipeline (`DocumentChunk.status`). */
export interface ChunkPipelineCounts {
  total: number;
  pending: number;
  queued: number;
  in_progress: number;
  completed: number;
  failed: number;
}

export interface PreprocessOverallStatus {
  phase: PreprocessPhase;
  ready: boolean;
  documents_total: number;
  documents_failed: number;
}

export interface DocumentStatusBreakdown {
  by_status: Record<DocumentStatus, number>;
}

export interface PreprocessFileStatus {
  id: string;
  file_name: string;
  document_status: DocumentStatus;
  content: boolean;
  phase: PreprocessPhase;
  uploaded_at: string;
  chunks: ChunkPipelineCounts;
  entities: VectorPipelineCounts;
  relations: VectorPipelineCounts;
  chunk_vectors: VectorPipelineCounts;
  embedding_progress: number;
}

export interface WorkspacePreprocessStatusResponse {
  workspace: string;
  overall: PreprocessOverallStatus;
  documents: DocumentStatusBreakdown;
  vectors: {
    entities: VectorPipelineCounts;
    relations: VectorPipelineCounts;
    chunks: VectorPipelineCounts;
  };
  files: PreprocessFileStatus[];
}

export async function getWorkspacePreprocessStatus(
  workspaceName: string
): Promise<WorkspacePreprocessStatusResponse> {
  const response = await fetch(
    `${API_ROOT}/workspace/${encodeURIComponent(workspaceName)}/preprocess-status/`
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return response.json();
}

// --- Knowledge graph ---

/** Slim node shape from GET /api/knowledge-graph/ and search graph payloads. */
export interface ApiGraphNode {
  id: string;
  name: string;
  entity_type: string;
}

export interface ApiGraphEdge {
  id?: string;
  source: string;
  target: string;
  source_id?: string;
  target_id?: string;
  type_description?: string;
}

export interface EntityTypeEntry {
  type: string;
  count: number;
}

export interface GraphFetchParams {
  entityTypes?: string[];
  fileNames?: string[];
  depth?: number;
  limit?: number;
}

export interface EntitySearchMatch {
  id: string;
  name: string;
  entity_type: string;
  score: number;
  workspace?: string;
}

export const KB_DEFAULT_DEPTH = 1;
/**
 * Safe default node budget for KG subgraph loads.
 * Single workspace: used as the request `limit` directly.
 * Flagged scope: divided by starred workspace count for per-workspace `limit`.
 */
export const KB_DEFAULT_LIMIT = 200;
/**
 * Max node budget for Graph load slider.
 * Single workspace: used as per-request max directly.
 * Flagged scope: divided by starred workspace count for per-workspace max.
 */
export const KB_MAX_LIMIT = 500;
export const KB_INITIAL_TYPE_COUNT = 3;
export const KB_DEFAULT_SEARCH_THRESHOLD = 0.6;

/** Per-workspace `limit` when splitting an aggregate budget across starred workspaces. */
export function kbPerWorkspaceLimitFromBudget(
  budget: number,
  flaggedCount: number
): number {
  const n = Math.max(1, Math.floor(flaggedCount));
  return Math.max(1, Math.floor(budget / n));
}

export function kbDefaultLimitForGroup(memberCount: number): number {
  return kbPerWorkspaceLimitFromBudget(KB_DEFAULT_LIMIT, memberCount);
}

export function kbMaxLimitForGroup(memberCount: number): number {
  return kbPerWorkspaceLimitFromBudget(KB_MAX_LIMIT, memberCount);
}

/** @deprecated Use kbDefaultLimitForGroup */
export const kbDefaultLimitForFlagged = kbDefaultLimitForGroup;

/** @deprecated Use kbMaxLimitForGroup */
export const kbMaxLimitForFlagged = kbMaxLimitForGroup;

/** Divisor for per-workspace node limits in group scope. */
export function groupLimitDivisor(
  apiMemberCount: number,
  selectedWorkspaceCount: number,
  workspaceFilterActive: boolean
): number {
  if (workspaceFilterActive && selectedWorkspaceCount > 0) {
    return selectedWorkspaceCount;
  }
  return Math.max(1, apiMemberCount);
}

/** @deprecated Use groupLimitDivisor */
export const flaggedLimitDivisor = groupLimitDivisor;

export interface FileReference {
  file_name: string;
  uuid: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  source: string[];
  attributes: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
  score: number;
  source_file: string[];
}

export interface KnowledgeGraphResponse {
  workspace: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  error?: string;
}

export interface KnowledgeGraphPayload extends KnowledgeGraphResponse {
  truncated?: boolean;
  /** Present when the request used `?group=<name>`. */
  group?: string;
  filters?: {
    entity_types?: string[] | null;
    file_names?: string[] | null;
    depth?: number;
    limit?: number;
  };
}

export interface ApiGraphPayload {
  workspace?: string;
  nodes?: ApiGraphNode[];
  edges?: ApiGraphEdge[];
  truncated?: boolean;
  filters?: KnowledgeGraphPayload["filters"];
}

export interface EntitySearchResponse {
  query: string;
  workspace?: string;
  filters?: Record<string, unknown>;
  matches: EntitySearchMatch[];
  graph?: ApiGraphPayload;
  workspaces?: Array<{
    workspace: string;
    matches: EntitySearchMatch[];
    graph?: ApiGraphPayload;
  }>;
}

function clampGraphLimit(limit?: number): number | undefined {
  if (limit == null) return undefined;
  return Math.min(KB_MAX_LIMIT, Math.max(1, Math.floor(limit)));
}

function graphFetchQueryParams(params?: GraphFetchParams): Record<string, string | undefined> {
  const q: Record<string, string | undefined> = {};
  if (params?.entityTypes && params.entityTypes.length > 0) {
    q.entity_type = params.entityTypes.join(",");
  }
  if (params?.fileNames && params.fileNames.length > 0) {
    q.file_name = params.fileNames.join(",");
  }
  if (params?.depth != null) q.depth = String(params.depth);
  const limit = clampGraphLimit(params?.limit);
  if (limit != null) q.limit = String(limit);
  return q;
}

function mapKnowledgeGraph(
  workspace: string,
  apiNodes: ApiGraphNode[],
  apiEdges: ApiGraphEdge[],
  extra?: { truncated?: boolean; filters?: KnowledgeGraphPayload["filters"] }
): KnowledgeGraphPayload {
  const nameToId = new Map(apiNodes.map((n) => [n.name, n.id]));

  const nodes: GraphNode[] = apiNodes.map((n) => ({
    id: n.id,
    label: n.name,
    type: n.entity_type,
    source: [],
    attributes: {},
  }));

  const edges: GraphEdge[] = apiEdges.map((e) => ({
    source: e.source_id ?? nameToId.get(e.source) ?? e.source,
    target: e.target_id ?? nameToId.get(e.target) ?? e.target,
    label: e.type_description ?? "",
    score: 0,
    source_file: [],
  }));

  return {
    workspace,
    nodes,
    edges,
    truncated: extra?.truncated,
    filters: extra?.filters,
  };
}

function mapGraphApiPayload(
  data: {
    workspace?: string;
    nodes?: ApiGraphNode[];
    edges?: ApiGraphEdge[];
    truncated?: boolean;
    filters?: KnowledgeGraphPayload["filters"];
  },
  fallbackWorkspace: string
): KnowledgeGraphPayload {
  return mapKnowledgeGraph(
    data.workspace ?? fallbackWorkspace,
    data.nodes ?? [],
    data.edges ?? [],
    { truncated: data.truncated, filters: data.filters }
  );
}

export async function getKnowledgeGraphEntityTypes(
  scope: KgApiScope
): Promise<{ workspace?: string; group?: string; entityTypes: EntityTypeEntry[] }> {
  const response = await fetch(
    buildApiUrl("/knowledge-graph/entity-types/", scopeToQueryParams(scope))
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const data = await response.json();

  if (isGroupScope(scope)) {
    const merged = new Map<string, number>();
    for (const ws of data.workspaces ?? []) {
      for (const et of ws.entity_types ?? []) {
        merged.set(et.type, (merged.get(et.type) ?? 0) + (et.count ?? 0));
      }
    }
    const entityTypes: EntityTypeEntry[] = Array.from(merged.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
    return { group: data.group ?? scope.group, entityTypes };
  }

  const entityTypes: EntityTypeEntry[] = (data.entity_types ?? []).sort(
    (a: EntityTypeEntry, b: EntityTypeEntry) => b.count - a.count
  );
  return { workspace: data.workspace, entityTypes };
}

export function topEntityTypesByCount(
  types: EntityTypeEntry[],
  count = KB_INITIAL_TYPE_COUNT
): string[] {
  return [...types]
    .sort((a, b) => b.count - a.count)
    .slice(0, count)
    .map((t) => t.type);
}

export async function getFilteredKnowledgeGraph(
  scope: KgApiScope,
  params?: GraphFetchParams
): Promise<KnowledgeGraphPayload> {
  const response = await fetch(
    buildApiUrl("/knowledge-graph/", {
      ...scopeToQueryParams(scope),
      ...graphFetchQueryParams(params),
    })
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error);
  }

  if (isGroupScope(scope)) {
    return mergeGroupGraphPayloads(data.graphs ?? [], data.group ?? scope.group);
  }

  return mapGraphApiPayload(data, scope.workspaceName);
}

export async function getKnowledgeGraph(
  workspaceName: string,
  params?: GraphFetchParams
): Promise<KnowledgeGraphResponse> {
  if (params) {
    return getFilteredKnowledgeGraph({ workspaceName }, params);
  }
  return getFilteredKnowledgeGraph(
    { workspaceName },
    { depth: KB_DEFAULT_DEPTH, limit: KB_DEFAULT_LIMIT }
  );
}

export async function getFlaggedKnowledgeGraphs(
  params?: GraphFetchParams
): Promise<KnowledgeGraphResponse[]> {
  const response = await fetch(
    buildApiUrl("/knowledge-graph/", {
      group: FLAGGED_GROUP_NAME,
      ...graphFetchQueryParams(params),
    })
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const data = await response.json();
  const graphs: {
    workspace: string;
    nodes: ApiGraphNode[];
    edges: ApiGraphEdge[];
    truncated?: boolean;
    filters?: KnowledgeGraphPayload["filters"];
  }[] = data.graphs ?? [];

  return graphs.map((g) => mapGraphApiPayload(g, g.workspace));
}

function mergeGroupGraphPayloads(
  graphs: Array<{
    workspace: string;
    nodes?: ApiGraphNode[];
    edges?: ApiGraphEdge[];
    truncated?: boolean;
    filters?: KnowledgeGraphPayload["filters"];
  }>,
  groupName: string
): KnowledgeGraphPayload {
  if (graphs.length === 0) {
    return {
      workspace: groupName,
      group: groupName,
      nodes: [],
      edges: [],
      truncated: false,
    };
  }

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const edgeSeen = new Set<string>();
  let truncated = false;

  for (const g of graphs) {
    if (g.truncated) truncated = true;
    const mapped = mapKnowledgeGraph(g.workspace, g.nodes ?? [], g.edges ?? []);
    const ws = g.workspace;
    const sid = (id: string) => scopedKnowledgeNodeId(ws, id);

    for (const n of mapped.nodes) {
      nodes.push({
        ...n,
        id: sid(n.id),
        attributes: { ...n.attributes, __kb_workspace: ws },
      });
    }
    for (const e of mapped.edges) {
      const source = sid(e.source as string);
      const target = sid(e.target as string);
      const key = `${source}\0${target}\0${e.label}`;
      if (edgeSeen.has(key)) continue;
      edgeSeen.add(key);
      edges.push({ ...e, source, target });
    }
  }

  return { workspace: groupName, group: groupName, nodes, edges, truncated };
}

export async function searchKnowledgeEntities(
  scope: KgApiScope,
  options: {
    q: string;
    threshold?: number;
    depth?: number;
    limit?: number;
    entityTypes?: string[];
    fileNames?: string[];
    matchLimit?: number;
  }
): Promise<EntitySearchResponse & { graphPayload: KnowledgeGraphPayload }> {
  const baseParams: Record<string, string | undefined> = {
    q: options.q.trim(),
    threshold: String(options.threshold ?? KB_DEFAULT_SEARCH_THRESHOLD),
    ...graphFetchQueryParams({
      depth: options.depth,
      limit: options.limit,
      entityTypes: options.entityTypes,
      fileNames: options.fileNames,
    }),
  };
  if (options.matchLimit != null) {
    baseParams.match_limit = String(options.matchLimit);
  }

  const response = await fetch(
    buildApiUrl("/knowledge/entities/search/", { ...scopeToQueryParams(scope), ...baseParams })
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const data: EntitySearchResponse = await response.json();

  let graphPayload: KnowledgeGraphPayload;
  if (isGroupScope(scope) && data.workspaces) {
    graphPayload = mergeGroupGraphPayloads(
      data.workspaces.map((w) => ({
        workspace: w.workspace,
        nodes: w.graph?.nodes,
        edges: w.graph?.edges,
        truncated: w.graph?.truncated,
        filters: w.graph?.filters,
      })),
      scope.group
    );
    const matches = data.workspaces.flatMap((w) =>
      (w.matches ?? []).map((m) => ({ ...m, workspace: w.workspace }))
    );
    return { ...data, matches, graphPayload };
  }

  const graph = data.graph;
  const fallbackWorkspace = isGroupScope(scope) ? scope.group : scope.workspaceName;
  graphPayload = graph
    ? mapGraphApiPayload(graph, graph.workspace ?? fallbackWorkspace)
    : { workspace: fallbackWorkspace, nodes: [], edges: [] };

  return { ...data, matches: data.matches ?? [], graphPayload };
}

/** Stable id for a node when merging multiple workspace graphs (avoids id collisions). */
function scopedKnowledgeNodeId(workspace: string, nodeId: string): string {
  return `${encodeURIComponent(workspace)}:${nodeId}`;
}

/**
 * Fetches all workspaces in the flagged group and merges graphs into one view.
 * Node ids are namespaced per workspace; each node gets `attributes.__kb_workspace`.
 */
export async function getMergedFlaggedKnowledgeGraph(
  params?: GraphFetchParams
): Promise<KnowledgeGraphPayload> {
  return getFilteredKnowledgeGraph(flaggedGroupScope(), params);
}

/** Parse raw entity UUID from a graph node id (handles flagged scoped ids). */
export function parseGraphNodeEntityId(nodeId: string): {
  scopedWorkspace: string | null;
  entityId: string;
} {
  const sep = nodeId.indexOf(":");
  if (sep > 0) {
    try {
      return {
        scopedWorkspace: decodeURIComponent(nodeId.slice(0, sep)),
        entityId: nodeId.slice(sep + 1),
      };
    } catch {
      return { scopedWorkspace: null, entityId: nodeId };
    }
  }
  return { scopedWorkspace: null, entityId: nodeId };
}

export interface GraphEntityRecord {
  kind: string;
  id: string;
  name: string;
  entity_type: string;
  file_name?: string;
  workspace?: string;
  attributes?: Record<string, unknown>;
  document_id?: string;
  chunk_id?: string | null;
  content?: string;
}

/** Full entity row for graph detail panel (GET /api/knowledge/entity/). */
export async function fetchGraphEntityRecord(
  nodeId: string,
  workspaceName: string | null
): Promise<GraphEntityRecord> {
  const { entityId } = parseGraphNodeEntityId(nodeId);
  const params: Record<string, string | undefined> = {};
  if (workspaceName) params.workspace_name = workspaceName;

  const response = await fetch(
    buildApiUrl(`/knowledge/entity/${encodeURIComponent(entityId)}/`, params)
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return response.json();
}

/** Entity/edge counts per document via depth=0 subgraph seeds. */
export async function getPerFileGraphCounts(
  workspaceName: string,
  fileNames: string[],
  options?: { concurrency?: number }
): Promise<Record<string, { nodes: number; edges: number }>> {
  const result: Record<string, { nodes: number; edges: number }> = {};
  const concurrency = Math.max(1, options?.concurrency ?? 4);

  for (let i = 0; i < fileNames.length; i += concurrency) {
    const batch = fileNames.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (fileName) => {
        try {
          const graph = await getFilteredKnowledgeGraph(
            { workspaceName },
            { fileNames: [fileName], depth: 0, limit: KB_MAX_LIMIT }
          );
          result[fileName] = {
            nodes: graph.nodes.length,
            edges: graph.edges.length,
          };
        } catch {
          result[fileName] = { nodes: 0, edges: 0 };
        }
      })
    );
  }

  return result;
}

/** Omit `file_name` query param when all catalog files are selected. */
export function resolveGraphFileNamesParam(
  availableFiles: string[],
  selectedFiles: Set<string>
): string[] | undefined {
  if (availableFiles.length === 0 || selectedFiles.size === 0) return undefined;
  const allSelected =
    selectedFiles.size >= availableFiles.length &&
    availableFiles.every((f) => selectedFiles.has(f));
  if (allSelected) return undefined;
  return Array.from(selectedFiles).sort((a, b) => a.localeCompare(b));
}

export async function listFilesForWorkspaces(workspaceNames: string[]): Promise<string[]> {
  const names = new Set<string>();
  await Promise.all(
    workspaceNames.map(async (ws) => {
      try {
        for (const f of await listFiles(ws)) names.add(f);
      } catch {
        /* skip workspace */
      }
    })
  );
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

// --- Legacy search types (provenance display in chat UI) ---

export type SearchEngineType =
  | "agent_search"
  | "global_search"
  | "local_search"
  | "hybrid_search";

export interface ProvenanceEntry {
  id: string;
  snippet: string;
  reason: string;
}

export interface ChatMessage {
  id: string;
  type: "user" | "bot";
  text: string;
  timestamp: Date;
  provenance?: ProvenanceEntry[];
}

