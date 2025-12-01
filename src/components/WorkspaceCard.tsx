"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, CheckCircle2, FolderCog, FileStack, GitGraph, Link } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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
}) => {
  const [isHovered, setIsHovered] = useState(false); // New state for hover
  const isThisWorkspaceDeleting = isDeleting && deletingWorkspaceName === workspaceName;

  return (
    <Card
      className={cn(
        "relative flex flex-col justify-between p-4 rounded-lg shadow-md transition-all duration-200 ease-in-out",
        "cursor-pointer", // Removed 'group' class as we're using local state
        "h-full w-full",
        isCurrent
          ? "border-2 border-primary bg-primary/5 ring-1 ring-primary/30 shadow-lg scale-[1.01]"
          : "border bg-card hover:shadow-lg hover:scale-[1.01] hover:border-accent hover:bg-secondary/10",
      )}
      onClick={() => onSelect(workspaceName)}
      onMouseEnter={() => setIsHovered(true)} // Set hovered state on mouse enter
      onMouseLeave={() => setIsHovered(false)} // Clear hovered state on mouse leave
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
          {/* Delete Button - now controlled by local isHovered state */}
          <Button
            variant="destructive"
            size="icon"
            onClick={(e) => {
              e.stopPropagation(); // Prevent card selection when clicking delete
              onDelete(workspaceName);
            }}
            disabled={isDeleting}
            className={cn(
              "ml-auto transition-all duration-200",
              "pointer-events-none", // Always disable pointer events by default
              (isHovered || isThisWorkspaceDeleting) ? "opacity-100 pointer-events-auto" : "opacity-0" // Show if hovered or deleting
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