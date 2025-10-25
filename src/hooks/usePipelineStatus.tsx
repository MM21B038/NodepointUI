import React, { useState, useEffect, useCallback } from "react";
import { getPipelineStatus, PipelineStatusResponse, ChunkEntry } from "@/database/workspaceStorage";

const POLLING_INTERVAL_MS = 5000; // Poll every 5 seconds

export function usePipelineStatus(workspaceName: string | null) {
  const [isPipelineRunning, setIsPipelineRunning] = useState(false); 
  const [pipelineData, setPipelineData] = useState<PipelineStatusResponse | null>(null);
  const [lastCheck, setLastCheck] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(false);

  const checkStatus = useCallback(async () => {
    if (!workspaceName) {
      setIsPipelineRunning(false);
      setPipelineData(null);
      setIsLoading(false);
      return;
    }

    // Set loading state only if we are not already running a pipeline (to avoid flicker during polling)
    // We use a functional update to ensure we don't rely on stale isPipelineRunning state here.
    setIsLoading(prev => prev || !isPipelineRunning); 

    try {
      const response = await getPipelineStatus(workspaceName);
      setPipelineData(response);

      // Determine if the pipeline is running (i.e., if there are any queued or running chunks)
      const running = (response.pipeline || []).some(
        (chunk: ChunkEntry) => chunk.status === 'queued' || chunk.status === 'running'
      );
      
      setIsPipelineRunning(running);
      setLastCheck(Date.now());
      
    } catch (error) {
      console.error("Error checking pipeline status, resetting state:", error);
      // If API call fails, assume pipeline is not running to prevent stuck UI
      setIsPipelineRunning(false);
      setPipelineData({ workspace: workspaceName, pipeline: [], error: "Failed to fetch status." });
    } finally {
      setIsLoading(false); // Clear loading after fetch
    }
    
  }, [workspaceName]); // Removed isPipelineRunning from dependencies

  // Effect 1: Reset state when workspace changes
  useEffect(() => {
    if (!workspaceName) {
      setIsPipelineRunning(false);
      setPipelineData(null);
      setIsLoading(false);
    }
  }, [workspaceName]);

  // Effect 2: Polling loop
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (workspaceName && isPipelineRunning) {
      // Start polling only if the pipeline is currently running
      intervalId = setInterval(() => {
        checkStatus();
      }, POLLING_INTERVAL_MS);
    }

    // If the pipeline stops running, clear the interval
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [workspaceName, isPipelineRunning, checkStatus]);

  // Effect 3: Initial check when workspace is selected (or when component mounts)
  useEffect(() => {
    if (workspaceName) {
      checkStatus();
    }
  }, [workspaceName]);


  return {
    isPipelineRunning,
    pipelineData,
    lastCheck,
    isLoading,
    refetch: checkStatus,
  };
}