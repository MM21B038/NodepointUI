"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Trash2,
  CheckCircle2,
  FolderCog,
  FileStack,
  Layers,
  GitGraph,
  Link,
  Play,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FLAGGED_GROUP_NAME,
  type PreprocessStartMode,
  type WorkspaceCounts,
} from "@/database/workspaceStorage";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import WorkspaceGroupMembership from "@/components/workspace/WorkspaceGroupMembership";

interface WorkspaceCardProps {
  workspaceName: string;
  isCurrent: boolean;
  onSelect: (workspaceName: string) => void;
  onDelete: (workspaceName: string) => void;
  isDeleting: boolean;
  deletingWorkspaceName: string | null;
  counts: WorkspaceCounts;
  onExtract: (workspaceName: string, mode?: PreprocessStartMode) => void;
  isExtracting: boolean;
  groups?: string[];
  onGroupsChanged?: () => void;
}

const WorkspaceCard: React.FC<WorkspaceCardProps> = ({
  workspaceName,
  isCurrent,
  onSelect,
  onDelete,
  isDeleting,
  deletingWorkspaceName,
  counts,
  onExtract,
  isExtracting,
  groups = [],
  onGroupsChanged,
}) => {
  const customGroups = groups.filter((g) => g !== FLAGGED_GROUP_NAME);
  const [isHovered, setIsHovered] = useState(false);

  const isThisWorkspaceDeleting =
    isDeleting && deletingWorkspaceName === workspaceName;
  const isDisabled = isDeleting || isExtracting;

  return (
    <Card
      className={cn(
        "relative flex flex-col justify-between p-4 rounded-lg shadow-md transition-all duration-200 ease-in-out min-h-[280px]",
        "cursor-pointer h-full w-full",
        isCurrent
          ? "border-2 border-primary bg-primary/5 ring-1 ring-primary/30 shadow-lg scale-[1.01]"
          : "border bg-card hover:shadow-lg hover:scale-[1.01] hover:border-accent hover:bg-secondary/10"
      )}
      onClick={() => onSelect(workspaceName)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardHeader className="p-0 flex flex-col space-y-2">
        <CardTitle className="text-xl font-bold flex items-center flex-grow min-w-0">
          <FolderCog
            className={cn(
              "h-6 w-6 mr-3 shrink-0",
              isCurrent ? "text-primary" : "text-muted-foreground"
            )}
          />
          <span
            className={cn(
              "break-words",
              isCurrent ? "text-primary" : "text-foreground"
            )}
          >
            {workspaceName}
          </span>
          {isCurrent && (
            <CheckCircle2 className="h-5 w-5 ml-2 text-green-500 flex-shrink-0" />
          )}
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
              isHovered || isThisWorkspaceDeleting
                ? "opacity-100 pointer-events-auto"
                : "opacity-0"
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
        {customGroups.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {customGroups.map((g) => (
              <Badge key={g} variant="outline" className="text-xs font-normal">
                {g}
              </Badge>
            ))}
          </div>
        )}

        <WorkspaceGroupMembership
          workspaceName={workspaceName}
          memberGroups={customGroups}
          onMembershipChanged={onGroupsChanged}
          disabled={isDisabled}
        />

        <div
          className="flex w-full gap-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => onExtract(workspaceName, "default")}
            disabled={isDisabled}
            className="flex-1 rounded-r-none flex items-center justify-center gap-2 text-primary hover:bg-primary/10"
          >
            {isExtracting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span>{isExtracting ? "Extracting..." : "Extract"}</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isDisabled}
                className="rounded-l-none border-l-0 px-2 text-primary hover:bg-primary/10"
                aria-label="Extract options"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onClick={() => onExtract(workspaceName, "this_workspace_only")}
              >
                This workspace only
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onExtract(workspaceName, "legacy")}
              >
                Legacy (orchestrator, this workspace)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center">
            <FileStack className="h-4 w-4 mr-1" />
            <span>Files</span>
          </div>
          <span className="font-medium text-foreground">{counts.files}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center">
            <Layers className="h-4 w-4 mr-1" />
            <span>Chunks</span>
          </div>
          <span className="font-medium text-foreground">{counts.chunks}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center">
            <GitGraph className="h-4 w-4 mr-1" />
            <span>Entities</span>
          </div>
          <span className="font-medium text-foreground">{counts.entities}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center">
            <Link className="h-4 w-4 mr-1" />
            <span>Relations</span>
          </div>
          <span className="font-medium text-foreground">{counts.relations}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkspaceCard;
