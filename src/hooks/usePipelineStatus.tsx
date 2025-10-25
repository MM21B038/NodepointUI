import React, { useState, useEffect, useCallback } from "react";
import { getPipelineStatus, PipelineStatusResponse, ChunkEntry } from "@/database/workspaceStorage";

export function usePipelineStatus(workspaceName: string | null) {
  const [isPipelineRunning, setIsPipelineRunning] = useState(false); 
  const [pipelineData, setPipelineData] = useState<PipelineStatusResponse | null>(null);
  const [lastCheck, setLastCheck] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(false); // New state

  const checkStatus = useCallback(async () => {
    if (!workspaceName) {
      setIsPipelineRunning(false);
      setPipelineData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true); // Set loading before fetch

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
    
  }, [workspaceName]);

  // startPolling is now just an alias for checkStatus, as there is no polling loop to start
  const startPolling = checkStatus; 

  // Effect 1: Removed initial check on mount/workspace change. 
  // Status is now only updated via manual calls to refetch/startPolling.
  useEffect(() => {
    if (!workspaceName) {
      setIsPipelineRunning(false);
      setPipelineData(null);
      setIsLoading(false);
    }
  }, [workspaceName]);


  return {
    isPipelineRunning,
    pipelineData,
    lastCheck,
    isLoading, // Export new state
    refetch: checkStatus,
    startPolling,
  };
}