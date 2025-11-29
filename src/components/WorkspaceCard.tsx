"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, CheckCircle2, FolderCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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
        "relative flex flex-col justify-between p-4 rounded-lg shadow-sm transition-all duration-200 ease-in-out",
        "cursor-pointer group",
        isCurrent
          ? "border-2 border-primary bg-primary/5 ring-2 ring-primary/20" // More subtle current styling
          : "border bg-card hover:shadow-md hover:border-accent hover:bg-secondary/10", // Subtle hover
      )}
      onClick={() => onSelect(workspaceName)}
    >
      <CardHeader className="p-0 pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center flex-grow min-w-0"> {/* Added flex-grow and min-w-0 */}
          <FolderCog className={cn("h-5 w-5 mr-2", isCurrent ? "text-primary" : "text-muted-foreground")} />
          <CardTitle className="text-lg font-semibold flex-grow min-w-0">
            <span className={cn("break-words", isCurrent ? "text-primary" : "text-foreground")}>
              {workspaceName}
            </span>
          </CardTitle>
        </div>
        {isCurrent && (
          <Badge variant="secondary" className="ml-2 flex-shrink-0"> {/* Subtle badge, flex-shrink-0 */}
            <CheckCircle2 className="h-3 w-3 mr-1" /> Current
          </Badge>
        )}
      </CardHeader>
      <CardContent className="p-0 flex justify-end items-center mt-4">
        <Button
          variant="destructive"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(workspaceName);
          }}
          disabled={isDeleting}
          className={cn(
            "transition-opacity duration-200",
            isCurrent ? "opacity-100" : "opacity-70 group-hover:opacity-100"
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