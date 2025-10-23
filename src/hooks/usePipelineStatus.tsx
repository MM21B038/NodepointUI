import React, { useState, useEffect, useCallback } from "react";
import { getPipelineStatus } from "@/database/workspaceStorage";

const POLLING_INTERVAL = 2000; // 2 seconds

export function usePipelineStatus(workspaceName: string | null) {
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const [pipelineData, setPipelineData] = useState<any>(null);
  const [lastCheck, setLastCheck] = useState(Date.now());

  const checkStatus = useCallback(async () => {
    if (!workspaceName) {
      setIsPipelineRunning(false);
      setPipelineData(null);
      return;
    }

    const response = await getPipelineStatus(workspaceName);
    setPipelineData(response);

    // Determine if the pipeline is running (i.e., if there are any queued or running chunks)
    // Safely access response.pipeline, defaulting to an empty array if undefined/null
    const running = (response.pipeline || []).some(
      (chunk) => chunk.status === 'queued' || chunk.status === 'running'
    );
    
    setIsPipelineRunning(running);
    setLastCheck(Date.now());
  }, [workspaceName]);

  useEffect(() => {
    if (!workspaceName) {
      setIsPipelineRunning(false);
      setPipelineData(null);
      return;
    }

    // Always run initial check when workspace changes or when polling starts/restarts
    checkStatus();

    let intervalId: ReturnType<typeof setInterval> | undefined;

    // Only start polling if the pipeline is currently running (as determined by the last checkStatus call)
    if (isPipelineRunning) {
      intervalId = setInterval(checkStatus, POLLING_INTERVAL);
    }

    // Cleanup function runs when dependencies change or component unmounts
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
    refetch: checkStatus,
  };
}