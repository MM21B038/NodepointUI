const API_BASE_URL = "http://10.166.154.141:3366";

interface WorkspaceListResponse {
  workspaces: string[];
}

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

export interface GraphNode {
  id: string;
  label: string;
  type: string; // e.g., "Person", "Concept"
  source: string; // file.stem (document name)
  attributes: Record<string, any>;
}

export interface GraphEdge {
  source: string; // Source Node ID
  target: string; // Target Node ID
  label: string; // Relationship description (was 'description')
  score: number; // Relationship score/weight
  source_file: string; // Document file name (was 'source')
}

export interface KnowledgeGraphResponse {
  workspace: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  error?: string;
}

/**
 * Retrieves all existing workspace names from the API.
 * @returns A promise that resolves to an array of workspace names.
 */
export async function getWorkspaces(): Promise<string[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/list_workspaces`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data: WorkspaceListResponse = await response.json();
    return data.workspaces || [];
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
 * Retrieves the knowledge graph data for a specific workspace.
 * @param workspaceName The name of the workspace.
 * @returns A promise that resolves to the KnowledgeGraphResponse.
 */
export async function getKnowledgeGraph(workspaceName: string): Promise<KnowledgeGraphResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/knowledge_base/${workspaceName}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error Response (${response.status}):`, errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: KnowledgeGraphResponse = await response.json();
    
    if (data.error) {
        throw new Error(data.error);
    }
    
    return data;
  } catch (error) {
    console.error(`Error fetching knowledge graph for ${workspaceName}:`, error);
    throw error;
  }
}