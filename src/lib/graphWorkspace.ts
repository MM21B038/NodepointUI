import type { GraphNode } from "@/database/workspaceStorage";

/** Workspace name stamped on merged flagged-graph nodes. */
export function getGraphNodeWorkspace(node: GraphNode): string | null {
  const ws = node.attributes.__kb_workspace;
  return typeof ws === "string" && ws.length > 0 ? ws : null;
}

export function collectGraphWorkspaceNames(nodes: GraphNode[]): string[] {
  const names = new Set<string>();
  for (const node of nodes) {
    const ws = getGraphNodeWorkspace(node);
    if (ws) names.add(ws);
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}
