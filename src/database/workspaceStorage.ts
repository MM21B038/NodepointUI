const API_BASE_URL = "http://10.10.112.72:3366";

// Updated interface for a single workspace entry
export interface WorkspaceEntry {
  workspace_name: string;
  timestamp: string; // ISO string
}

// The API now returns an array of WorkspaceEntry directly, not an object with a 'workspaces' key.
// So, WorkspaceListResponse is no longer needed as a wrapper.

interface FileListResponse {
  workspace: string;
  files: string[];
}

export interface ChunkEntry {
  chunk_uuid: string;
  pdf: string;
  range: [number, number];
  status: 'queued' | 'running' | 'success' | 'failed';
  queued_position: number | null;
  pid: number | null;
  pid_cpu_percent: number | null;
  pid_mem_mb: number | null;
  attempts: number;
  submitted_at: number | null;
  submitted_iso: string | null;
  completed_at: number | null;
  completed_iso: string | null;
  next_to_process: boolean;
}

export interface PipelineStatusResponse {
  workspace: string;
  pipeline: ChunkEntry[];
  error?: string;
}

export interface FilePreprocessStatus {
  pdf_name: string;
  total_pages: number;
  chunks_total: number;
  status: 'success' | 'failed' | 'pending';
  start_time: string | null;
  end_time: string | null;
  total_time: string | null;
}

export interface PreprocessStatusResponse {
  workspace: string;
  files: FilePreprocessStatus[];
  error?: string;
}

// --- Knowledge Graph Interfaces ---

// New interface to represent the file reference object
export interface FileReference {
  file_name: string;
  uuid: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string; // e.g., "Person", "Concept"
  source: string[]; // Changed to string[]
  attributes: Record<string, any>;
}

export interface GraphEdge {
  source: string; // Source Node ID
  target: string; // Target Node ID
  label: string; // Relationship description (was 'description')
  score: number; // Relationship score/weight
  source_file: string[]; // Changed to string[]
}

export interface KnowledgeGraphResponse {
  workspace: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  error?: string;
}

// --- Search Interfaces ---

export type SearchEngineType = "agent_search" | "global_search" | "local_search" | "hybrid_search";

export interface SearchFilter {
  files: string[] | "all";
}

export interface SearchRequest {
  query: string;
  filter: SearchFilter;
}

export interface ProvenanceEntry {
  id: string;
  snippet: string;
  reason: string;
}

export interface SearchResponse {
  message: {
    query: string;
    seed_ids: string[];
    steps_executed: number;
    history: any[];
    subgraph_nodes_count: number;
    subgraph_edges_count: number;
    synthesis: {
      answer: string;
      provenance: ProvenanceEntry[];
      recommended_next_steps: string[];
    };
  };
  error?: string;
}

// --- Chat History Interfaces ---
export interface ChatHistoryEntry {
  query: string;
  ai: string;
  // Updated type for source: it can be an array of ProvenanceEntry, a string, or null/undefined
  source: ProvenanceEntry[] | string | null | undefined;
  request_time: string; // ISO string
  response_time: string; // ISO string
}

// --- Chat Message Interface for UI Display ---
export interface ChatMessage {
  id: string;
  type: "user" | "bot";
  text: string;
  timestamp: Date;
  provenance?: ProvenanceEntry[];
}


/**
 * Retrieves all existing workspace names from the API.
 * @returns A promise that resolves to an array of WorkspaceEntry objects.
 */
export async function getWorkspaces(): Promise<WorkspaceEntry[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/list_workspaces`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    // The API now returns an array of WorkspaceEntry directly
    const data: WorkspaceEntry[] = await response.json();
    return data || [];
  } catch (error) {
    console.error("Error fetching workspaces:", error);
    return [];
  }
}

/**
 * Creates a new workspace via the API.
 * @param name The name of the workspace to create.
 * @returns A promise that resolves to true if creation was successful, false otherwise (e.g., if it already exists).
 */
export async function createWorkspace(name: string): Promise<boolean> {
  const normalizedName = name.trim();
  if (!normalizedName) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/create_workspace`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: normalizedName }),
    });

    if (response.ok) {
      return true;
    }

    // Check for specific error message (like 'already exists')
    const errorData = await response.json();
    if (response.status === 409 || (errorData.detail && errorData.detail.includes("already exists"))) {
      // Treat existing workspace as a known failure case
      return false;
    }

    throw new Error(`Failed to create workspace: ${response.statusText}`);
  } catch (error) {
    console.error("Error creating workspace:", error);
    return false;
  }
}

/**
 * Retrieves the list of files for a specific workspace from the API.
 * @param workspaceName The name of the workspace.
 * @returns A promise that resolves to an array of file names.
 */
export async function listFiles(workspaceName: string): Promise<string[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/list_files/${workspaceName}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data: FileListResponse = await response.json();
    return data.files || [];
  } catch (error) {
    console.error(`Error fetching files for workspace ${workspaceName}:`, error);
    return [];
  }
}

/**
 * Uploads a file to the specified workspace.
 * @param workspaceName The name of the target workspace.
 * @param file The file object to upload.
 * @returns A promise that resolves to true on success.
 */
export async function uploadFile(workspaceName: string, file: File): Promise<boolean> {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch(`${API_BASE_URL}/upload_file/${workspaceName}`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `Failed to upload file: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error(`Error uploading file to ${workspaceName}:`, error);
    throw error;
  }
}

/**
 * Deletes a specific file from a workspace.
 * @param workspaceName The name of the workspace.
 * @param fileName The name of the file to delete.
 * @returns A promise that resolves to true on success.
 */
export async function deleteFile(workspaceName: string, fileName: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/delete_file/${workspaceName}/${fileName}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `Failed to delete file: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error(`Error deleting file ${fileName} from ${workspaceName}:`, error);
    throw error;
  }
}

/**
 * Deletes an entire workspace.
 * @param workspaceName The name of the workspace to delete.
 * @returns A promise that resolves to true on success.
 */
export async function deleteWorkspace(workspaceName: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/delete_workspace/${workspaceName}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `Failed to delete workspace: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error(`Error deleting workspace ${workspaceName}:`, error);
    throw error;
  }
}

/**
 * Starts the preprocessing pipeline for a workspace.
 * @param workspaceName The name of the workspace.
 * @returns A promise that resolves with the API message.
 */
export async function startPreprocess(workspaceName: string): Promise<{ message: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/do_preprocess`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: workspaceName }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `Failed to start preprocessing: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error(`Error starting preprocessing for ${workspaceName}:`, error);
    throw error;
  }
}

/**
 * Gets the detailed pipeline status (queued/running chunks).
 * @param workspaceName The name of the workspace.
 * @returns A promise that resolves with the pipeline status data.
 */
export async function getPipelineStatus(workspaceName: string): Promise<PipelineStatusResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/pipeline_status/${workspaceName}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  } catch (error) {
    console.error(`Error fetching pipeline status for ${workspaceName}:`, error);
    return { workspace: workspaceName, pipeline: [], error: "Failed to fetch pipeline status." };
  }
}

/**
 * Gets the overall preprocessing status summary for all files.
 * @param workspaceName The name of the workspace.
 * @returns A promise that resolves with the preprocessing status summary.
 */
export async function getPreprocessStatus(workspaceName: string): Promise<PreprocessStatusResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/preprocess_status/${workspaceName}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  } catch (error) {
    console.error(`Error fetching preprocess status for ${workspaceName}:`, error);
    return { workspace: workspaceName, files: [], error: "Failed to fetch preprocess status." };
  }
}

/**
 * Normalizes a single source entry (string or FileReference) into an array of string filenames.
 * This function attempts to split concatenated filenames based on a heuristic pattern.
 *
 * IMPORTANT: This is a fragile heuristic based on observed API output (e.g., "file1_timestampfile2_timestamp").
 * The most robust solution is for the backend to provide source fields as proper arrays of strings.
 */
const normalizeSourceEntry = (source: string | FileReference): string[] => {
  if (typeof source === 'object' && source !== null && 'file_name' in source) {
    return [source.file_name];
  }

  const sourceString = String(source);
  // Regex to identify the start of a filename pattern: digits_word_scan_timestamp_part
  // This is used for splitting, so it's a lookahead.
  // The pattern is: digits, underscore, word chars, underscore, 'scan', underscore, digits-digits-digitsTdigits:digits:digits.digits
  // We want to split *before* the next occurrence of this pattern.
  const filenameStartPattern = /(?=\d+_\w+_scan_\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+)/;
  
  const parts = sourceString.split(filenameStartPattern).filter(part => part.length > 0);

  if (parts.length > 0) {
    return parts;
  } else {
    // Fallback: if split didn't work as expected, or no pattern found, treat the whole string as a single source.
    return [sourceString];
  }
};

/**
 * Retrieves the knowledge graph data for a specific workspace.
 * @param workspaceName The name of the workspace.
 * @returns A promise that resolves to the KnowledgeGraphResponse.
 */
export async function getKnowledgeGraph(workspaceName: string): Promise<KnowledgeGraphResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/knowledge_base_new/${workspaceName}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error Response (${response.status}):`, errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: KnowledgeGraphResponse = await response.json();

    if (data.error) {
        throw new Error(data.error);
    }

    // Normalize source fields to always be arrays of strings using the new helper
    const normalizedNodes: GraphNode[] = data.nodes.map(node => ({
      ...node,
      // Ensure node.source is always an array before mapping
      source: Array.isArray(node.source)
        ? node.source.flatMap(normalizeSourceEntry) // Use flatMap to handle potential arrays from normalizeSourceEntry
        : normalizeSourceEntry(node.source), // If it's a single item, normalize it
    }));

    const normalizedEdges: GraphEdge[] = data.edges.map(edge => ({
      ...edge,
      // Ensure edge.source_file is always an array before mapping
      source_file: Array.isArray(edge.source_file)
        ? edge.source_file.flatMap(normalizeSourceEntry) // Use flatMap
        : normalizeSourceEntry(edge.source_file), // If it's a single item, normalize it
    }));

    return { ...data, nodes: normalizedNodes, edges: normalizedEdges };
  } catch (error) {
    console.error(`Error fetching knowledge graph for ${workspaceName}:`, error);
    throw error;
  }
}

/**
 * Performs a search query using the specified engine and file filters.
 * @param workspaceName The name of the workspace.
 * @param engine The search engine to use.
 * @param query The search query string.
 * @param filesFilter An array of file names or 'all' to filter the search.
 * @returns A promise that resolves to an object containing the answer and provenance.
 */
export async function performSearch(
  workspaceName: string,
  engine: SearchEngineType,
  query: string,
  filesFilter: string[] | "all"
): Promise<{ answer: string; provenance: ProvenanceEntry[] }> {
  try {
    const body: SearchRequest = {
      query: query,
      filter: { files: filesFilter },
    };

    const response = await fetch(`${API_BASE_URL}/search/${workspaceName}/${engine}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `Search failed: ${response.statusText}`);
    }

    const data: SearchResponse = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }
    // Extract the answer and provenance from the nested message structure
    return {
      answer: data.message.synthesis.answer,
      provenance: data.message.synthesis.provenance,
    };
  } catch (error) {
    console.error(`Error performing search in ${workspaceName} with ${engine}:`, error);
    throw error;
  }
}

/**
 * Asks a question to the AI, using the default agent search and all files.
 * @param workspaceName The name of the workspace.
 * @param query The question to ask.
 * @returns A promise that resolves to an object containing the answer and provenance.
 */
export async function askQuestion(
  workspaceName: string,
  query: string
): Promise<{ answer: string; provenance: ProvenanceEntry[] }> {
  return performSearch(workspaceName, "agent_search", query, "all");
}

/**
 * Retrieves chat history for a specific workspace.
 * @param workspaceName The name of the workspace.
 * @returns A promise that resolves to an array of ChatHistoryEntry.
 */
export async function getChatHistory(workspaceName: string): Promise<ChatHistoryEntry[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/get_chat/${workspaceName}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data: ChatHistoryEntry[] = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching chat history for ${workspaceName}:`, error);
    return [];
  }
}