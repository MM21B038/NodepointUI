"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  FolderCog,
  FileStack,
  Layers,
  GitGraph,
  Link,
  Play,
  Loader2,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FLAGGED_GROUP_NAME, type WorkspaceCounts } from "@/database/workspaceStorage";
import { DirectoryCardFrame } from "@/components/directory/DirectoryCardFrame";
import {
  directoryActionsClass,
  directoryCardAccentActionClass,
  directoryStatGridClass,
} from "@/components/directory/directoryCardStyles";
import { statTone } from "@/lib/brandColors";
import WorkspaceGroupMembership from "@/components/workspace/WorkspaceGroupMembership";

interface WorkspaceCardProps {
  workspaceName: string;
  workspaceOwnerId?: number;
  ownerUsername?: string | null;
  /** Show owner badge when names repeat across owners on the page. */
  showOwnerLabel?: boolean;
  tag?: string | null;
  description?: string | null;
  isCurrent: boolean;
  onSelect: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  isDeletingThis?: boolean;
  deletingWorkspaceName: string | null;
  isSelected?: boolean;
  onSelectionChange?: (checked: boolean) => void;
  showSelection?: boolean;
  counts: WorkspaceCounts;
  onExtract?: (workspaceName: string) => void;
  isExtracting?: boolean;
  groups?: string[];
  onGroupsChanged?: () => void;
  onEdit?: () => void;
}

const statItems = (
  counts: WorkspaceCounts
): { label: string; value: number; icon: typeof FileStack; tone: string }[] => [
  { label: "Files", value: counts.files, icon: FileStack, tone: statTone.files },
  { label: "Chunks", value: counts.chunks, icon: Layers, tone: statTone.chunks },
  { label: "Entities", value: counts.entities, icon: GitGraph, tone: statTone.entities },
  { label: "Relations", value: counts.relations, icon: Link, tone: statTone.relations },
];

const WorkspaceCard: React.FC<WorkspaceCardProps> = ({
  workspaceName,
  workspaceOwnerId,
  ownerUsername,
  showOwnerLabel,
  tag,
  description,
  isCurrent,
  onSelect,
  onDelete,
  isDeleting,
  isDeletingThis = false,
  deletingWorkspaceName,
  isSelected = false,
  onSelectionChange,
  showSelection = false,
  counts,
  onExtract,
  isExtracting = false,
  groups = [],
  onGroupsChanged,
  onEdit,
}) => {
  const customGroups = groups.filter((g) => g !== FLAGGED_GROUP_NAME);
  const isThisWorkspaceDeleting =
    isDeletingThis || (isDeleting && deletingWorkspaceName === workspaceName);
  const isDisabled = isDeleting || isExtracting;

  return (
    <div className="h-full">
      <DirectoryCardFrame
        accent="workspace"
        name={workspaceName}
        ownerUsername={ownerUsername}
        showOwnerLabel={showOwnerLabel}
        tag={tag}
        description={description}
        isActive={isCurrent}
        isSelected={isSelected}
        showSelection={showSelection}
        isDeleting={isDeleting}
        isDisabled={isDisabled}
        isThisDeleting={isThisWorkspaceDeleting}
        onSelect={onSelect}
        onDelete={onDelete}
        onSelectionChange={onSelectionChange}
        activeLabel="Current"
        icon={<FolderCog className="h-5 w-5" />}
        footer={
          <div className={directoryActionsClass()}>
            <WorkspaceGroupMembership
              workspaceName={workspaceName}
              workspaceOwnerId={workspaceOwnerId}
              workspaceOwnerUsername={ownerUsername}
              memberGroups={customGroups}
              onMembershipChanged={onGroupsChanged}
              disabled={isDisabled}
            />

            <div className="grid grid-cols-2 gap-2">
              {onEdit ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.();
                  }}
                  disabled={isDisabled}
                  className="h-9 gap-2 border-border/60"
                >
                  <Pencil className="h-4 w-4" />
                  <span>Edit</span>
                </Button>
              ) : null}
              {onExtract ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onExtract(workspaceName);
                  }}
                  disabled={isDisabled}
                  className={cn(
                    directoryCardAccentActionClass("workspace"),
                    !onEdit && "col-span-2"
                  )}
                >
                  {isExtracting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  <span>{isExtracting ? "Extracting…" : "Run extract"}</span>
                </Button>
              ) : null}
            </div>
          </div>
        }
      >
        <div className={directoryStatGridClass()}>
          {statItems(counts).map(({ label, value, icon: Icon, tone }) => (
            <div
              key={label}
              className="flex items-center justify-between gap-2 rounded-md bg-background/60 px-2 py-1.5"
            >
              <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                <Icon className={cn("h-3.5 w-3.5 shrink-0", tone)} />
                <span className="truncate">{label}</span>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                {value}
              </span>
            </div>
          ))}
        </div>
      </DirectoryCardFrame>
    </div>
  );
};

export default WorkspaceCard;
