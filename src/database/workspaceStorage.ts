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

export interface WorkspaceEntry {
  name: string;
  is_flag: boolean;
  created_at: string;
}

export async function getWorkspaces(): Promise<WorkspaceEntry[]> {
  try {
    const response = await fetch(`${API_ROOT}/workspace/list/`);
    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }
    const data: WorkspaceEntry[] = await response.json();
    return (data || []).map((ws) => ({
      ...ws,
      is_flag: Boolean(ws.is_flag),
    }));
  } catch (error) {
    console.error("Error fetching workspaces:", error);
    return [];
  }
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

export interface ApiGraphNode {
  id: string;
  name: string;
  entity_type: string;
  attributes: Record<string, unknown>;
  document_id: string;
  file_name: string;
  vector: string;
  created_at: string;
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
  depth?: number;
  limit?: number;
}

export interface EntitySearchMatch {
  id: string;
  name: string;
  entity_type: string;
  score: number;
  workspace?: string;
  document_id?: string;
  file_name?: string;
  vector?: string;
  created_at?: string;
}

export const KB_DEFAULT_DEPTH = 1;
export const KB_DEFAULT_LIMIT = 100;
export const KB_MAX_LIMIT = 500;
export const KB_INITIAL_TYPE_COUNT = 3;
export const KB_DEFAULT_SEARCH_THRESHOLD = 0.6;

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
  filters?: {
    entity_types?: string[] | null;
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
    source: n.file_name ? [n.file_name] : [],
    attributes: n.attributes ?? {},
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
  scope: { workspaceName: string } | { flagged: true }
): Promise<{ workspace?: string; entityTypes: EntityTypeEntry[] }> {
  const params =
    "flagged" in scope
      ? { flagged: "true" }
      : { workspace_name: scope.workspaceName };

  const response = await fetch(buildApiUrl("/knowledge-graph/entity-types/", params));
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const data = await response.json();

  if ("flagged" in scope) {
    const merged = new Map<string, number>();
    for (const ws of data.workspaces ?? []) {
      for (const et of ws.entity_types ?? []) {
        merged.set(et.type, (merged.get(et.type) ?? 0) + (et.count ?? 0));
      }
    }
    const entityTypes: EntityTypeEntry[] = Array.from(merged.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
    return { entityTypes };
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
  scope: { workspaceName: string } | { flagged: true },
  params?: GraphFetchParams
): Promise<KnowledgeGraphPayload> {
  const baseParams =
    "flagged" in scope
      ? { flagged: "true" }
      : { workspace_name: scope.workspaceName };

  const response = await fetch(
    buildApiUrl("/knowledge-graph/", { ...baseParams, ...graphFetchQueryParams(params) })
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error);
  }

  if ("flagged" in scope) {
    return mergeFlaggedGraphPayloads(data.graphs ?? []);
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
    { depth: KB_DEFAULT_DEPTH, limit: KB_MAX_LIMIT }
  );
}

export async function getFlaggedKnowledgeGraphs(
  params?: GraphFetchParams
): Promise<KnowledgeGraphResponse[]> {
  const response = await fetch(
    buildApiUrl("/knowledge-graph/", { flagged: "true", ...graphFetchQueryParams(params) })
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

function mergeFlaggedGraphPayloads(
  graphs: Array<{
    workspace: string;
    nodes?: ApiGraphNode[];
    edges?: ApiGraphEdge[];
    truncated?: boolean;
    filters?: KnowledgeGraphPayload["filters"];
  }>
): KnowledgeGraphPayload {
  if (graphs.length === 0) {
    return { workspace: "flagged", nodes: [], edges: [], truncated: false };
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

  return { workspace: "flagged", nodes, edges, truncated };
}

export async function searchKnowledgeEntities(
  scope: { workspaceName: string } | { flagged: true },
  options: {
    q: string;
    threshold?: number;
    depth?: number;
    limit?: number;
    entityTypes?: string[];
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
    }),
  };
  if (options.matchLimit != null) {
    baseParams.match_limit = String(options.matchLimit);
  }

  const params =
    "flagged" in scope
      ? { flagged: "true", ...baseParams }
      : { workspace_name: scope.workspaceName, ...baseParams };

  const response = await fetch(buildApiUrl("/knowledge/entities/search/", params));
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const data: EntitySearchResponse = await response.json();

  let graphPayload: KnowledgeGraphPayload;
  if ("flagged" in scope && data.workspaces) {
    graphPayload = mergeFlaggedGraphPayloads(
      data.workspaces.map((w) => ({
        workspace: w.workspace,
        nodes: w.graph?.nodes,
        edges: w.graph?.edges,
        truncated: w.graph?.truncated,
        filters: w.graph?.filters,
      }))
    );
    const matches = data.workspaces.flatMap((w) =>
      (w.matches ?? []).map((m) => ({ ...m, workspace: w.workspace }))
    );
    return { ...data, matches, graphPayload };
  }

  const graph = data.graph;
  const fallbackWorkspace = "workspaceName" in scope ? scope.workspaceName : "flagged";
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
 * Fetches all flagged (starred) workspace graphs and merges them into one view.
 * Node ids are namespaced per workspace; each node gets `attributes.__kb_workspace`.
 */
export async function getMergedFlaggedKnowledgeGraph(
  params?: GraphFetchParams
): Promise<KnowledgeGraphPayload> {
  return getFilteredKnowledgeGraph({ flagged: true }, params);
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

