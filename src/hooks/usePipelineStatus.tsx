import React, { useState, useEffect, useCallback } from "react";
import { getPipelineStatus, PipelineStatusResponse, ChunkEntry } from "@/database/workspaceStorage";

const POLLING_INTERVAL = 20000; // 20 seconds

export function usePipelineStatus(workspaceName: string | null) {
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const [pipelineData, setPipelineData] = useState<PipelineStatusResponse | null>(null);
  const [lastCheck, setLastCheck] = useState(Date.now());
  const [forcePolling, setForcePolling] = useState(false);

  const checkStatus = useCallback(async () => {
    if (!workspaceName) {
      setIsPipelineRunning(false);
      setPipelineData(null);
      setForcePolling(false);
      return;
    }

    const response = await getPipelineStatus(workspaceName);
    setPipelineData(response);

    // Determine if the pipeline is running (i.e., if there are any queued or running chunks)
    const running = (response.pipeline || []).some(
      (chunk: ChunkEntry) => chunk.status === 'queued' || chunk.status === 'running'
    );
    
    setIsPipelineRunning(running);
    setLastCheck(Date.now());
    
    // If the API confirms it's not running, stop forcing polling
    if (!running) {
      setForcePolling(false);
    }
    
  }, [workspaceName]);

  const startPolling = useCallback(() => {
    if (workspaceName) {
      // 1. Set running state immediately to show the icon
      setIsPipelineRunning(true); 
      // 2. Force polling flag
      setForcePolling(true);
      // 3. Run initial check (which will correct the state if the job finished instantly)
      checkStatus(); 
    }
  }, [workspaceName, checkStatus]);

  // Effect 1: Initial check when workspace changes
  useEffect(() => {
    if (workspaceName) {
      // Reset states when workspace changes and perform initial check
      setIsPipelineRunning(false);
      setForcePolling(false);
      checkStatus();
    } else {
      setIsPipelineRunning(false);
      setPipelineData(null);
      setForcePolling(false);
    }
  }, [workspaceName, checkStatus]);

  // Effect 2: Polling interval management
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;

    // Start polling if the pipeline is running OR if we are forcing a check
    if (workspaceName && (isPipelineRunning || forcePolling)) {
      intervalId = setInterval(checkStatus, POLLING_INTERVAL);
    }

    // Cleanup function runs when dependencies change or component unmounts
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [workspaceName, isPipelineRunning, forcePolling, checkStatus]);

  return {
    isPipelineRunning,
    pipelineData,
    lastCheck,
    refetch: checkStatus,
    startPolling,
  };
}