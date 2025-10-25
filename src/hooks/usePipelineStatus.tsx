// src/hooks/usePipelineStatus.tsx
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { getPipelineStatus, PipelineStatusResponse, ChunkEntry } from "@/database/workspaceStorage";

/**
 * Hook to track pipeline status for a given workspace.
 * - Logs responses for easy debugging
 * - Accepts a few common running-state variants from API
 * - Exposes refetch(workspace?) and forceReset()
 */
export function usePipelineStatus(workspaceName: string | null) {
  const [isPipelineRunning, setIsPipelineRunning] = useState<boolean>(false);
  const [pipelineData, setPipelineData] = useState<PipelineStatusResponse | null>(null);
  const [lastCheck, setLastCheck] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // canonical set of statuses that indicate "work is in progress"
  const RUNNING_STATUSES = new Set([
    "queued",
    "running",
    // some backends use different names — include them defensively
    "processing",
    "in_progress",
    "started",
    "pending",
  ]);

  const checkStatus = useCallback(
    async (overrideWorkspace?: string | null) => {
      const ws = overrideWorkspace ?? workspaceName;
      if (!ws) {
        // reset state if no workspace
        setIsPipelineRunning(false);
        setPipelineData(null);
        setIsLoading(false);
        console.debug("[usePipelineStatus] checkStatus called with no workspace -> reset");
        return null;
      }

      setIsLoading(true);
      try {
        const response: PipelineStatusResponse = await getPipelineStatus(ws);
        setPipelineData(response);

        const pipeline: ChunkEntry[] = response.pipeline || [];

        // Defensive logging to see exact payload from server
        console.debug("[usePipelineStatus] pipeline response for", ws, response);

        // compute running: any chunk whose status matches a running-like status
        const running = pipeline.some((chunk) => {
          // ensure chunk.status exists and is a string
          const s = String((chunk && (chunk as any).status) ?? "").toLowerCase();
          return RUNNING_STATUSES.has(s);
        });

        // Guarantee boolean and set state
        setIsPipelineRunning(Boolean(running));
        setLastCheck(Date.now());

        console.debug("[usePipelineStatus] computed running =", running, "for workspace", ws);

        return response;
      } catch (error) {
        console.error("[usePipelineStatus] Error fetching pipeline status:", error);
        // On error assume not running to prevent stuck UI; but record an error payload
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
    void checkStatus();
  }, [checkStatus]);

  // When workspace name changes, refetch for that workspace (avoid stale closure).
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
        await checkStatus(workspaceName);
        if (cancelled) return;
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
