"use client";

import { GroupTagBadge } from "@/components/group/GroupTagBadge";
import type { GroupTag } from "@/database/workspaceStorage";
import { formatGroupMemberCount } from "@/lib/groupTag";
import { metaDescription } from "@/lib/resourceMeta";

interface GroupMembersHeaderProps {
  groupName: string;
  tag: GroupTag;
  description?: string | null;
  memberCount: number;
}

export function GroupMembersHeader({
  groupName,
  tag,
  description,
  memberCount,
}: GroupMembersHeaderProps) {
  const descriptionText = metaDescription({ description });

  return (
    <div className="space-y-2 border-b border-border/60 pb-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold">{groupName}</h3>
        <GroupTagBadge tag={tag} />
        <span className="text-xs text-muted-foreground">
          {formatGroupMemberCount({ tag, member_count: memberCount })}
        </span>
      </div>
      {descriptionText ? (
        <p className="text-sm text-muted-foreground">{descriptionText}</p>
      ) : null}
    </div>
  );
}
