"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, CheckCircle2, FolderCog, FileStack, GitGraph } from "lucide-react"; // Added FileStack, GitGraph
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge"; // Added Badge import

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
        "relative flex flex-col justify-between p-6 rounded-lg shadow-md transition-all duration-200 ease-in-out", // Increased padding
        "cursor-pointer group", // Added group for hover effects
        isCurrent
          ? "border-2 border-primary ring-2 ring-primary/50 shadow-lg scale-[1.02] bg-gradient-to-br from-primary/10 to-background"
          : "border bg-card hover:shadow-lg hover:scale-[1.02] hover:border-accent hover:bg-secondary/20", // Added hover background
      )}
      onClick={() => onSelect(workspaceName)}
    >
      <CardHeader className="p-0 pb-4 flex flex-col space-y-2"> {/* Adjusted padding and spacing */}
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold flex items-center"> {/* Increased font size and boldness */}
            <FolderCog className="h-6 w-6 mr-3 text-primary" /> {/* Slightly larger icon, primary color */}
            <span className={cn("break-words", isCurrent ? "text-primary" : "text-foreground")}>
              {workspaceName}
            </span>
          </CardTitle>
          {isCurrent && (
            <Badge variant="default" className="bg-primary text-primary-foreground"> {/* Using Badge for 'Current' */}
              <CheckCircle2 className="h-4 w-4 mr-1" /> Current
            </Badge>
          )}
        </div>
        
        {/* Placeholder for Workspace Statistics */}
        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <div className="flex items-center">
            <FileStack className="h-4 w-4 mr-1" />
            <span>Documents: 0</span> {/* Placeholder */}
          </div>
          <div className="flex items-center">
            <GitGraph className="h-4 w-4 mr-1" />
            <span>Nodes: 0 | Edges: 0</span> {/* Placeholder */}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex justify-end items-center mt-4"> {/* Adjusted margin-top */}
        <Button
          variant="destructive"
          size="icon"
          onClick={(e) => {
            e.stopPropagation(); // Prevent selecting workspace when clicking delete
            onDelete(workspaceName);
          }}
          disabled={isDeleting}
          className={cn(
            "transition-opacity duration-200",
            isCurrent ? "opacity-100" : "opacity-70 group-hover:opacity-100" // Always visible if current, more visible on hover if not
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