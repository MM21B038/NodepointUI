"use client";

import React, { useCallback, useEffect, useState } from "react";
import { getPipelineStatus, PipelineStatusResponse, ChunkEntry } from "@/database/workspaceStorage";

const POLLING_INTERVAL_MS = 5000; // Poll every 5 seconds

/**
 * Hook to track pipeline status for a given workspace.
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
    "processing",
    "in_progress",
    "started",
    "pending",
  ]);

  const checkStatus = useCallback(
    async (overrideWorkspace?: string | null) => {
      const ws = overrideWorkspace ?? workspaceName;
      if (!ws) {
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

        const running = pipeline.some((chunk) => {
          const s = String((chunk && (chunk as any).status) ?? "").toLowerCase();
          return RUNNING_STATUSES.has(s);
        });

        setIsPipelineRunning(Boolean(running));
        setLastCheck(Date.now());

        return response;
      } catch (error) {
        console.error("[usePipelineStatus] Error fetching pipeline status:", error);
        setIsPipelineRunning(false);
        setPipelineData({ workspace: ws, pipeline: [], error: "Failed to fetch status." });
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [workspaceName]
  );

  // 1. Initial fetch/fetch on workspace change
  useEffect(() => {
    if (workspaceName) {
      void checkStatus(workspaceName);
    } else {
      setIsPipelineRunning(false);
      setPipelineData(null);
    }
  }, [workspaceName, checkStatus]);

  // 2. Polling logic: Poll status if a workspace is selected AND the pipeline is currently running.
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (workspaceName && isPipelineRunning) {
      intervalId = setInterval(() => {
        void checkStatus();
      }, POLLING_INTERVAL_MS);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [workspaceName, isPipelineRunning, checkStatus]);


  return {
    isPipelineRunning,
    pipelineData,
    lastCheck,
    isLoading,
    refetch: checkStatus,
  };
}