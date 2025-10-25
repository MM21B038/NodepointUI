import React, { useState, useEffect, useCallback } from "react";
import { getPipelineStatus, PipelineStatusResponse, ChunkEntry } from "@/database/workspaceStorage";

export function usePipelineStatus(workspaceName: string | null) {
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const [pipelineData, setPipelineData] = useState<PipelineStatusResponse | null>(null);
  const [lastCheck, setLastCheck] = useState(Date.now());

  const checkStatus = useCallback(async () => {
    if (!workspaceName) {
      setIsPipelineRunning(false);
      setPipelineData(null);
      return;
    }

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
    }
    
  }, [workspaceName]);

  // Effect 1: Initial check when workspace changes (Manual check only)
  useEffect(() => {
    if (workspaceName) {
      checkStatus();
    } else {
      setIsPipelineRunning(false);
      setPipelineData(null);
    }
  }, [workspaceName, checkStatus]);

  // Removed Effect 2 (Polling interval management)

  return {
    isPipelineRunning,
    pipelineData,
    lastCheck,
    refetch: checkStatus,
    // startPolling is now redundant, we will rely on refetch
    startPolling: checkStatus, 
  };
}