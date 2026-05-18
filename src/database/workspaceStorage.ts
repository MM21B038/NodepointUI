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
  source: string;
  target: string;
}

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

function mapKnowledgeGraph(
  workspace: string,
  apiNodes: ApiGraphNode[],
  apiEdges: ApiGraphEdge[]
): KnowledgeGraphResponse {
  const nameToId = new Map(apiNodes.map((n) => [n.name, n.id]));

  const nodes: GraphNode[] = apiNodes.map((n) => ({
    id: n.id,
    label: n.name,
    type: n.entity_type,
    source: n.file_name ? [n.file_name] : [],
    attributes: n.attributes ?? {},
  }));

  const edges: GraphEdge[] = apiEdges.map((e) => ({
    source: nameToId.get(e.source) ?? e.source,
    target: nameToId.get(e.target) ?? e.target,
    label: "",
    score: 0,
    source_file: [],
  }));

  return { workspace, nodes, edges };
}

export async function getKnowledgeGraph(workspaceName: string): Promise<KnowledgeGraphResponse> {
  const response = await fetch(
    buildApiUrl("/knowledge-graph/", { workspace_name: workspaceName })
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error);
  }

  return mapKnowledgeGraph(
    data.workspace ?? workspaceName,
    data.nodes ?? [],
    data.edges ?? []
  );
}

export async function getFlaggedKnowledgeGraphs(): Promise<KnowledgeGraphResponse[]> {
  const response = await fetch(buildApiUrl("/knowledge-graph/", { flagged: "true" }));
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const data = await response.json();
  const graphs: { workspace: string; nodes: ApiGraphNode[]; edges: ApiGraphEdge[] }[] =
    data.graphs ?? [];

  return graphs.map((g) => mapKnowledgeGraph(g.workspace, g.nodes ?? [], g.edges ?? []));
}

/** Stable id for a node when merging multiple workspace graphs (avoids id collisions). */
function scopedKnowledgeNodeId(workspace: string, nodeId: string): string {
  return `${encodeURIComponent(workspace)}:${nodeId}`;
}

/**
 * Fetches all flagged (starred) workspace graphs and merges them into one view.
 * Node ids are namespaced per workspace; each node gets `attributes.__kb_workspace`.
 */
export async function getMergedFlaggedKnowledgeGraph(): Promise<KnowledgeGraphResponse> {
  const graphs = await getFlaggedKnowledgeGraphs();
  if (graphs.length === 0) {
    return { workspace: "flagged", nodes: [], edges: [] };
  }

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const edgeSeen = new Set<string>();

  for (const g of graphs) {
    const ws = g.workspace;
    const sid = (id: string) => scopedKnowledgeNodeId(ws, id);

    for (const n of g.nodes ?? []) {
      nodes.push({
        ...n,
        id: sid(n.id),
        attributes: { ...n.attributes, __kb_workspace: ws },
      });
    }
    for (const e of g.edges ?? []) {
      const source = sid(e.source as string);
      const target = sid(e.target as string);
      const key = `${source}\0${target}\0${e.label}\0${e.score}`;
      if (edgeSeen.has(key)) continue;
      edgeSeen.add(key);
      edges.push({
        ...e,
        source,
        target,
      });
    }
  }

  return { workspace: "flagged", nodes, edges };
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

