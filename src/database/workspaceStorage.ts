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
 * Checks if a workspace name already exists by attempting to create it.
 * NOTE: Since we have a dedicated API endpoint for creation that handles existence, 
 * we will rely on the API response from createWorkspace for existence checks.
 * For now, we will remove the client-side check as it's redundant/inaccurate with a backend.
 * The dialog component will handle the existence check based on the result of createWorkspace.
 */
// export function workspaceExists(name: string): boolean { ... } - Removed as it's now handled by the API call.