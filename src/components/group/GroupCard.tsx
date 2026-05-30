"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { FolderKanban, Pencil, Users } from "lucide-react";
import { DirectoryCardFrame } from "@/components/directory/DirectoryCardFrame";
import {
  directoryActionsClass,
  directoryCardAccentActionClass,
} from "@/components/directory/directoryCardStyles";
import type { GroupTag } from "@/database/workspaceStorage";
import { formatGroupMemberCount, formatGroupTag, groupTagTone } from "@/lib/groupTag";
import { cn } from "@/lib/utils";

interface GroupCardProps {
  groupName: string;
  groupTag: GroupTag;
  description?: string | null;
  memberCount: number;
  isActive: boolean;
  onSelect: (groupName: string) => void;
  onManageMembers: (groupName: string) => void;
  onEdit: (groupName: string) => void;
  onDelete: (groupName: string) => void;
  isDeleting: boolean;
  deletingGroupName: string | null;
  isSelected?: boolean;
  onSelectionChange?: (checked: boolean) => void;
  showSelection?: boolean;
}

const GroupCard: React.FC<GroupCardProps> = ({
  groupName,
  groupTag,
  description,
  memberCount,
  isActive,
  onSelect,
  onManageMembers,
  onEdit,
  onDelete,
  isDeleting,
  deletingGroupName,
  isSelected = false,
  onSelectionChange,
  showSelection = false,
}) => {
  const isThisGroupDeleting = isDeleting && deletingGroupName === groupName;
  const memberLabel = formatGroupMemberCount({ tag: groupTag, member_count: memberCount });
  const tagTone = groupTagTone(groupTag);

  return (
    <div className="h-full">
      <DirectoryCardFrame
        accent="group"
        name={groupName}
        tag={formatGroupTag(groupTag)}
        tagClassName={tagTone.pill}
        description={description}
        isActive={isActive}
        isSelected={isSelected}
        showSelection={showSelection}
        isDeleting={isDeleting}
        isThisDeleting={isThisGroupDeleting}
        onSelect={() => onSelect(groupName)}
        onDelete={() => onDelete(groupName)}
        onSelectionChange={onSelectionChange}
        activeLabel="Selected scope"
        icon={<FolderKanban className="h-5 w-5" />}
        footer={
          <div className={directoryActionsClass()}>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(groupName);
                }}
                disabled={isDeleting}
                className="h-9 gap-2 border-border/60"
              >
                <Pencil className="h-4 w-4" />
                <span>Edit</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onManageMembers(groupName);
                }}
                disabled={isDeleting}
                className={directoryCardAccentActionClass("group")}
              >
                <Users className="h-4 w-4" />
                <span>Members</span>
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/20 px-2.5 py-1.5">
          <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
            <FolderKanban className={cn("h-3.5 w-3.5 shrink-0", tagTone.text)} />
            <span className={cn("truncate text-[11px] font-medium capitalize", tagTone.text)}>
              {formatGroupTag(groupTag)}
            </span>
          </div>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
            {memberLabel}
          </span>
        </div>
      </DirectoryCardFrame>
    </div>
  );
};

export default GroupCard;
