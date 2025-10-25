import React, { useState, useEffect, useCallback } from "react";
import { getPipelineStatus, PipelineStatusResponse, ChunkEntry } from "@/database/workspaceStorage";

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

    setIsLoading(true);

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
      // If pipeline is empty, running remains false.

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
    
  }, [workspaceName]);

  // Function to manually reset the running state and trigger a refetch
  const forceReset = useCallback(() => {
    setIsPipelineRunning(false);
    // Immediately trigger a refetch to get the true status from the API
    checkStatus();
  }, [checkStatus]);


  // Effect: Reset state when workspace changes, but DO NOT trigger a fetch.
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
    isLoading,
    refetch: checkStatus,
    forceReset, // Expose forceReset
  };
}