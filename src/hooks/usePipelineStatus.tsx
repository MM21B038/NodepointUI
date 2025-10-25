import React, { useState, useEffect, useCallback } from "react";
import { getPipelineStatus, PipelineStatusResponse, ChunkEntry } from "@/database/workspaceStorage";

// Poll every 5 seconds
const POLLING_INTERVAL = 5000; 

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

    // Only show loading state if it's the first fetch or a manual refetch
    // We suppress loading state during background polling to avoid UI flicker
    if (!pipelineData) {
      setIsLoading(true);
    }

    try {
      const response = await getPipelineStatus(workspaceName);
      setPipelineData(response);

      const pipeline = response.pipeline || [];
      
      let running = false;
      
      if (pipeline.length > 0) {
        // Determine if the pipeline is running (i.e., if there are any queued or running chunks)
        running = pipeline.some(
          (chunk: ChunkEntry) => chunk.status === 'queued' || chunk.status === 'running'
        );
      }

      setIsPipelineRunning(running);
      setLastCheck(Date.now());
      
    } catch (error) {
      console.error("Error checking pipeline status, resetting state:", error);
      // If API call fails, assume pipeline is not running to prevent stuck UI
      setIsPipelineRunning(false);
      setPipelineData({ workspace: workspaceName, pipeline: [], error: "Failed to fetch status." });
    } finally {
      setIsLoading(false);
    }
    
  }, [workspaceName, pipelineData]); // Added pipelineData to dependencies to control loading state visibility

  // Function to manually reset the running state and trigger a refetch
  const forceReset = useCallback(() => {
    setIsPipelineRunning(false);
    // Immediately trigger a refetch to get the true status from the API
    checkStatus();
  }, [checkStatus]);


  // Effect 1: Polling mechanism
  useEffect(() => {
    if (!workspaceName) {
      setIsPipelineRunning(false);
      setPipelineData(null);
      setIsLoading(false);
      return;
    }

    // Start polling only if a workspace is selected
    const intervalId = setInterval(() => {
      checkStatus();
    }, POLLING_INTERVAL);

    // Cleanup function to clear the interval when the component unmounts or workspaceName changes
    return () => clearInterval(intervalId);
  }, [workspaceName, checkStatus]);


  // Effect 2: Initial fetch when workspaceName changes (or on mount via Documents.tsx)
  // We rely on the initial fetch in Documents.tsx (fetchWorkspaces -> refetchPipelineStatus)
  // and the polling mechanism above. We can remove the redundant useEffect that only resets state.
  
  return {
    isPipelineRunning,
    pipelineData,
    lastCheck,
    isLoading,
    refetch: checkStatus,
    forceReset,
  };
}