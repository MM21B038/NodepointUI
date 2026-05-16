"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, CheckCircle2, FolderCog, FileStack, GitGraph, Link, Play, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { toggleWorkspaceFlag } from "@/database/workspaceStorage";

interface WorkspaceCardProps {
  workspaceName: string;
  isCurrent: boolean;
  onSelect: (workspaceName: string) => void;
  onDelete: (workspaceName: string) => void;
  isDeleting: boolean;
  deletingWorkspaceName: string | null;
  totalFiles?: number;
  totalNodes?: number;
  totalEdges?: number;
  isLoadingStats?: boolean;
  onExtract: (workspaceName: string) => void;
  isExtracting: boolean;
  isFlagged: boolean; // New prop for flag status
}

const WorkspaceCard: React.FC<WorkspaceCardProps> = ({
  workspaceName,
  isCurrent,
  onSelect,
  onDelete,
  isDeleting,
  deletingWorkspaceName,
  totalFiles,
  totalNodes,
  totalEdges,
  isLoadingStats,
  onExtract,
  isExtracting,
  isFlagged: initialIsFlagged, // Renamed to avoid conflict with state
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isFlagged, setIsFlagged] = useState(initialIsFlagged); // Initialize from prop
  const [isFlagging, setIsFlagging] = useState(false);

  // Update internal state if initialIsFlagged prop changes
  useEffect(() => {
    setIsFlagged(initialIsFlagged);
  }, [initialIsFlagged]);

  const isThisWorkspaceDeleting = isDeleting && deletingWorkspaceName === workspaceName;
  const isDisabled = isDeleting || isExtracting || isFlagging;

  const handleFlagToggle = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection
    setIsFlagging(true);
    const loadingToastId = toast.loading(`Updating flag for workspace ${workspaceName}...`);

    try {
      const response = await toggleWorkspaceFlag(workspaceName);
      setIsFlagged(response.is_flag);
      toast.success(response.message, { id: loadingToastId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update workspace flag.";
      toast.error(errorMessage, { id: loadingToastId });
      console.error(`Error toggling flag for workspace ${workspaceName}:`, error);
    } finally {
      setIsFlagging(false);
    }
  }, [workspaceName, isFlagged]);

  return (
    <Card
      className={cn(
        "relative flex flex-col justify-between p-4 rounded-lg shadow-md transition-all duration-200 ease-in-out",
        "cursor-pointer",
        "h-full w-full",
        isCurrent
          ? "border-2 border-primary bg-primary/5 ring-1 ring-primary/30 shadow-lg scale-[1.01]"
          : "border bg-card hover:shadow-lg hover:scale-[1.01] hover:border-accent hover:bg-secondary/10",
      )}
      onClick={() => onSelect(workspaceName)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardHeader className="p-0 flex flex-col space-y-2">
        <CardTitle className="text-xl font-bold flex items-center flex-grow min-w-0">
          <FolderCog className={cn("h-6 w-6 mr-3", isCurrent ? "text-primary" : "text-muted-foreground")} />
          <span className={cn("break-words", isCurrent ? "text-primary" : "text-foreground")}>
            {workspaceName}
          </span>
          {/* Tick Icon for Current Workspace */}
          {isCurrent && (
            <CheckCircle2 className="h-5 w-5 ml-2 text-green-500 flex-shrink-0" />
          )}
          {/* Delete Button */}
          <Button
            variant="destructive"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(workspaceName);
            }}
            disabled={isDisabled}
            className={cn(
              "ml-auto transition-all duration-200",
              "pointer-events-none",
              (isHovered || isThisWorkspaceDeleting) ? "opacity-100 pointer-events-auto" : "opacity-0"
            )}
          >
            {isThisWorkspaceDeleting ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Trash2 className="h-6 w-6" />
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex flex-col gap-2 mt-4">
        {/* Flag Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleFlagToggle}
          disabled={isDisabled}
          className={cn(
            "w-full flex items-center justify-center gap-2",
            isFlagged ? "text-green-600 hover:bg-green-100" : "text-red-600 hover:bg-red-100"
          )}
        >
          {isFlagging ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Flag className={cn("h-4 w-4", isFlagged ? "fill-green-600" : "fill-red-600")} />
          )}
          <span>{isFlagging ? (isFlagged ? "Unflagging..." : "Flagging...") : (isFlagged ? "Flagged" : "Unflagged")}</span>
        </Button>

        {/* Extract Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onExtract(workspaceName);
          }}
          disabled={isDisabled}
          className="w-full flex items-center justify-center gap-2 text-primary hover:bg-primary/10"
        >
          {isExtracting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          <span>{isExtracting ? "Extracting..." : "Extract"}</span>
        </Button>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center">
            <FileStack className="h-4 w-4 mr-1" />
            <span>Files:</span>
          </div>
          <span className="font-medium text-foreground">
            {isLoadingStats ? <Loader2 className="inline h-3 w-3 animate-spin" /> : totalFiles ?? 0}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center">
            <GitGraph className="h-4 w-4 mr-1" />
            <span>Nodes:</span>
          </div>
          <span className="font-medium text-foreground">
            {isLoadingStats ? <Loader2 className="inline h-3 w-3 animate-spin" /> : totalNodes ?? 0}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center">
            <Link className="h-4 w-4 mr-1" />
            <span>Edges:</span>
          </div>
          <span className="font-medium text-foreground">
            {isLoadingStats ? <Loader2 className="inline h-3 w-3 animate-spin" /> : totalEdges ?? 0}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkspaceCard;