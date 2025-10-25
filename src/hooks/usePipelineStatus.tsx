// usePipelineStatus.tsx
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { getPipelineStatus, PipelineStatusResponse, ChunkEntry } from "@/database/workspaceStorage";

/**
 * Hook to track pipeline status for a given workspace.
 *
 * Guarantees:
 * - Automatically fetches status when workspaceName changes.
 * - Exposes `refetch(workspace?)` to allow callers to force-check a specific workspace.
 * - Exposes `forceReset()` to clear running flag and immediately recheck.
 */
export function usePipelineStatus(workspaceName: string | null) {
  const [isPipelineRunning, setIsPipelineRunning] = useState<boolean>(false);
  const [pipelineData, setPipelineData] = useState<PipelineStatusResponse | null>(null);
  const [lastCheck, setLastCheck] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const checkStatus = useCallback(
    // optional overrideWorkspace ensures callers can request checks for a workspace
    async (overrideWorkspace?: string | null) => {
      const ws = overrideWorkspace ?? workspaceName;
      if (!ws) {
        // no workspace -> reset state
        setIsPipelineRunning(false);
        setPipelineData(null);
        setIsLoading(false);
        return null;
      }

      setIsLoading(true);
      try {
        const response: PipelineStatusResponse = await getPipelineStatus(ws);
        setPipelineData(response);

        const pipeline: ChunkEntry[] = response.pipeline || [];

        const running = pipeline.some((chunk) =>
          chunk.status === "queued" || chunk.status === "running"
        );

        setIsPipelineRunning(running);
        setLastCheck(Date.now());

        return response;
      } catch (error) {
        console.error("Error fetching pipeline status:", error);
        // On error assume not running to prevent stuck UI; still record an error payload
        setIsPipelineRunning(false);
        setPipelineData({ workspace: ws, pipeline: [], error: "Failed to fetch status." });
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [workspaceName]
  );

  const forceReset = useCallback(() => {
    // Clear the running flag locally and kick a fresh API check.
    setIsPipelineRunning(false);
    // request a fresh check for the current workspace
    void checkStatus();
  }, [checkStatus]);

  // IMPORTANT: when the workspaceName changes, automatically check status.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!workspaceName) {
        setIsPipelineRunning(false);
        setPipelineData(null);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        // call checkStatus with workspaceName to avoid stale closure problems
        const resp = await checkStatus(workspaceName);
        if (cancelled) return;
        // state has been set inside checkStatus
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspaceName, checkStatus]);

  return {
    isPipelineRunning,
    pipelineData,
    lastCheck,
    isLoading,
    refetch: checkStatus,
    forceReset,
  };
}
