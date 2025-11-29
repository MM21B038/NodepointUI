"use client";

import React, { useState, useEffect, useCallback } from "react";
import { FolderCog, Info, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWorkspace } from "@/context/WorkspaceContext";
import { getWorkspaces } from "@/database/workspaceStorage";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const WorkspaceManagement = () => {
  const { currentWorkspace, setCurrentWorkspace } = useWorkspace();
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchWorkspaces = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await getWorkspaces();
      list.sort((a, b) => b.localeCompare(a)); // Sort in descending order
      setWorkspaces(list);

      if (currentWorkspace && !list.includes(currentWorkspace)) {
        setCurrentWorkspace(null);
      }
      if (!currentWorkspace && list.length > 0) {
        setCurrentWorkspace(list[0]);
      }
    } catch (error) {
      console.error("Failed to fetch workspaces:", error);
      toast.error("Failed to load workspaces.");
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace, setCurrentWorkspace]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const handleSelectWorkspace = (workspaceName: string) => {
    setCurrentWorkspace(workspaceName);
    toast.success(`Switched to workspace: ${workspaceName}`);
  };

  return (
    <div className="flex flex-col h-full flex-grow">
      <Card className="flex-grow flex flex-col">
        <CardHeader>
          <CardTitle>Available Workspaces</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col">
          {isLoading ? (
            <div className="flex-grow flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading workspaces...</span>
            </div>
          ) : workspaces.length === 0 ? (
            <div className="flex-grow flex items-center justify-center">
              <Alert className="max-w-lg">
                <Info className="h-4 w-4" />
                <AlertTitle>No Workspaces Found</AlertTitle>
                <AlertDescription>
                  It looks like you don't have any workspaces yet. Use the controls in the navigation bar to create one!
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <ScrollArea className="flex-grow h-0 rounded-md border hide-scrollbar">
              <ul className="divide-y">
                {workspaces.map((workspace) => (
                  <li
                    key={workspace}
                    className={cn(
                      "flex items-center justify-between p-3 transition-colors cursor-pointer",
                      currentWorkspace === workspace ? "bg-primary text-primary-foreground" : "hover:bg-accent/50",
                    )}
                    onClick={() => handleSelectWorkspace(workspace)}
                  >
                    <span className="font-medium truncate">
                      {workspace}
                      {currentWorkspace === workspace && " (Current)"}
                    </span>
                    {currentWorkspace !== workspace && (
                      <Button variant="secondary" size="sm">
                        Select
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkspaceManagement;