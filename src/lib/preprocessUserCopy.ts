import type {
  PreprocessPhase,
  WorkspacePreprocessStatusResponse,
} from "@/database/workspaceStorage";

const FRIENDLY_PHASE: Record<PreprocessPhase, string> = {
  idle: "Idle",
  needs_prepare: "Waiting to process",
  queued: "Queued",
  processing: "Extracting knowledge",
  embedding: "Indexing for search",
  ready: "Ready",
  kg_ready: "Ready",
  failed: "Failed",
};

export function friendlyPhaseLabel(phase: PreprocessPhase): string {
  return FRIENDLY_PHASE[phase] ?? phase;
}

export function workspaceReadinessBanner(
  status: WorkspacePreprocessStatusResponse
): string {
  if (status.overall.ready) {
    return "All documents are indexed. You can chat and search over this workspace.";
  }
  switch (status.overall.phase) {
    case "needs_prepare":
      return "Some documents need processing before they appear in chat and search.";
    case "failed":
      return "One or more documents failed. Try processing again or re-upload the file.";
    case "queued":
    case "processing":
      return "Your uploads are being analyzed. This usually takes a few minutes.";
    case "embedding":
      return "Almost done — building the search index for your documents.";
    case "idle":
      return "Upload .txt or .md files to get started.";
    default:
      return "Processing your documents…";
  }
}

export function countFilesInProgress(
  status: WorkspacePreprocessStatusResponse
): number {
  if (status.overall.ready) return 0;
  return status.files.filter(
    (f) => f.phase !== "ready" && f.phase !== "kg_ready"
  ).length;
}

export function workspaceNeedsPreprocessRetry(
  status: WorkspacePreprocessStatusResponse
): boolean {
  if (status.overall.phase === "needs_prepare" || status.overall.phase === "failed") {
    return true;
  }
  if (status.overall.documents_failed > 0) return true;
  return status.files.some(
    (f) =>
      f.phase === "failed" ||
      f.legacy ||
      f.document_status === "FAILED" ||
      f.document_status === "INVALID" ||
      f.document_status === "TERMINATED"
  );
}

export function showUserRetryButton(
  status: WorkspacePreprocessStatusResponse | null
): boolean {
  if (!status) return false;
  if (!workspaceNeedsPreprocessRetry(status)) return false;
  const activePhases: PreprocessPhase[] = ["queued", "processing", "embedding"];
  if (
    activePhases.includes(status.overall.phase) &&
    status.overall.documents_failed === 0 &&
    !status.files.some((f) => f.phase === "failed")
  ) {
    return false;
  }
  return true;
}

export type PreprocessTableVariant = "user" | "admin";

export function preprocessTableVariant(isAdmin: boolean): PreprocessTableVariant {
  return isAdmin ? "admin" : "user";
}
