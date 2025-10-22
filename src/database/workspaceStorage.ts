const WORKSPACE_STORAGE_KEY = "app_workspaces";

/**
 * Retrieves all existing workspace names from local storage.
 * @returns An array of workspace names.
 */
export function getWorkspaces(): string[] {
  if (typeof window === "undefined") return [];
  
  try {
    const storedData = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    return storedData ? JSON.parse(storedData) : [];
  } catch (error) {
    console.error("Error reading workspaces from local storage:", error);
    return [];
  }
}

/**
 * Creates a new workspace if it doesn't already exist.
 * @param name The name of the workspace to create.
 * @returns true if creation was successful, false if the workspace already exists.
 */
export function createWorkspace(name: string): boolean {
  if (typeof window === "undefined") return false;

  const normalizedName = name.trim();
  if (!normalizedName) return false;

  const existingWorkspaces = getWorkspaces();

  if (existingWorkspaces.includes(normalizedName)) {
    return false; // Already exists
  }

  const newWorkspaces = [...existingWorkspaces, normalizedName];
  
  try {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(newWorkspaces));
    return true;
  } catch (error) {
    console.error("Error saving new workspace to local storage:", error);
    return false;
  }
}

/**
 * Checks if a workspace name already exists.
 * @param name The name to check.
 * @returns true if the workspace exists, false otherwise.
 */
export function workspaceExists(name: string): boolean {
    const normalizedName = name.trim();
    if (!normalizedName) return false;
    const existingWorkspaces = getWorkspaces();
    return existingWorkspaces.includes(normalizedName);
}