"use client";

import React, { useState, useEffect } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { getWorkspaces } from "@/database/workspaceStorage";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

const WorkspaceSelector = () => {
  const { currentWorkspace, setCurrentWorkspace } = useWorkspace();
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchWorkspaces = async () => {
    setIsLoading(true);
    try {
      const list = await getWorkspaces();
      setWorkspaces(list);
      
      // If the current workspace is no longer in the list, clear it
      if (currentWorkspace && !list.includes(currentWorkspace)) {
        setCurrentWorkspace(null);
      }
      
      // If no workspace is selected, default to the first one if available
      if (!currentWorkspace && list.length > 0) {
        setCurrentWorkspace(list[0]);
      }

    } catch (error) {
      console.error("Failed to fetch workspaces:", error);
      toast.error("Failed to load workspaces.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const handleSelectChange = (value: string) => {
    setCurrentWorkspace(value);
  };

  return (
    <div className="flex items-center space-x-2">
      <Select value={currentWorkspace || ""} onValueChange={handleSelectChange}>
        <SelectTrigger className="w-[200px] bg-card text-foreground hover:bg-card/90">
          <SelectValue placeholder="Select Workspace" />
        </SelectTrigger>
        <SelectContent>
          {workspaces.length === 0 ? (
            <SelectItem value="no-workspace" disabled>No Workspaces Found</SelectItem>
          ) : (
            workspaces.map(ws => (
              <SelectItem key={ws} value={ws}>
                {ws}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
};

export default WorkspaceSelector;