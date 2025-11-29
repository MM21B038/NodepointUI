"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, CheckCircle2, FolderCog } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkspaceCardProps {
  workspaceName: string;
  isCurrent: boolean;
  onSelect: (workspaceName: string) => void;
  onDelete: (workspaceName: string) => void;
  isDeleting: boolean;
  deletingWorkspaceName: string | null;
}

const WorkspaceCard: React.FC<WorkspaceCardProps> = ({
  workspaceName,
  isCurrent,
  onSelect,
  onDelete,
  isDeleting,
  deletingWorkspaceName,
}) => {
  const isThisWorkspaceDeleting = isDeleting && deletingWorkspaceName === workspaceName;

  return (
    <Card
      className={cn(
        "relative flex flex-col justify-between p-4 rounded-lg shadow-md transition-all duration-200 ease-in-out",
        "cursor-pointer group", // Added group for hover effects
        isCurrent
          ? "border-2 border-primary ring-2 ring-primary/50 shadow-lg scale-[1.02] bg-gradient-to-br from-primary/10 to-background"
          : "border bg-card hover:shadow-lg hover:scale-[1.02] hover:border-accent",
      )}
      onClick={() => onSelect(workspaceName)}
    >
      {isCurrent && (
        <div className="absolute top-2 right-2 flex items-center text-xs font-semibold text-primary">
          <CheckCircle2 className="h-4 w-4 mr-1" /> Current
        </div>
      )}
      <CardHeader className="p-0 pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold flex items-center">
          <FolderCog className="h-5 w-5 mr-2 text-muted-foreground" />
          <span className={cn("truncate max-w-[calc(100%-2.5rem)]", isCurrent ? "text-primary" : "text-foreground")}>
            {workspaceName}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex justify-end items-center space-x-2 mt-4">
        {!isCurrent && (
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation(); // Prevent selecting workspace when clicking select button
              onSelect(workspaceName);
            }}
            disabled={isDeleting}
            className="group-hover:opacity-100 opacity-0 transition-opacity duration-200" // Show on hover
          >
            Select
          </Button>
        )}
        <Button
          variant="destructive"
          size="icon"
          onClick={(e) => {
            e.stopPropagation(); // Prevent selecting workspace when clicking delete
            onDelete(workspaceName);
          }}
          disabled={isDeleting}
          className={cn(
            "group-hover:opacity-100 transition-opacity duration-200", // Always visible if current, show on hover if not
            isCurrent ? "opacity-100" : "opacity-0"
          )}
        >
          {isThisWorkspaceDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default WorkspaceCard;