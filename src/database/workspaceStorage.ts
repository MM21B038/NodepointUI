const API_BASE_URL = "http://127.0.0.1:3366";

interface WorkspaceListResponse {
  workspaces: string[];
}

interface FileListResponse {
  workspace: string;
  files: string[];
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