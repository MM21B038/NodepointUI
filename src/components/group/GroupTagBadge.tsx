"use client";

import { Tag } from "lucide-react";
import type { GroupTag } from "@/database/workspaceStorage";
import { formatGroupTag, groupTagTone } from "@/lib/groupTag";
import { cn } from "@/lib/utils";

interface GroupTagBadgeProps {
  tag: GroupTag | string | null | undefined;
  size?: "xs" | "sm";
  showIcon?: boolean;
  className?: string;
}

export function GroupTagBadge({
  tag,
  size = "sm",
  showIcon = false,
  className,
}: GroupTagBadgeProps) {
  const tone = groupTagTone(tag);

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md border font-semibold",
        size === "xs"
          ? "px-1.5 py-0.5 text-[10px] uppercase tracking-wide"
          : "px-2 py-0.5 text-xs",
        tone.pill,
        className
      )}
      title={formatGroupTag(tag)}
    >
      {showIcon ? <Tag className="h-2.5 w-2.5 shrink-0 opacity-75" /> : null}
      <span className="truncate">{formatGroupTag(tag)}</span>
    </span>
  );
}

export function GroupTagDot({
  tag,
  className,
}: {
  tag: GroupTag | string | null | undefined;
  className?: string;
}) {
  return (
    <span
      className={cn("h-2 w-2 shrink-0 rounded-full", groupTagTone(tag).dot, className)}
      aria-hidden
    />
  );
}
