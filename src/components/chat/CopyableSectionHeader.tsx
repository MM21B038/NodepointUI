"use client";

import { CopyButton } from "@/components/chat/CopyButton";
import { cn } from "@/lib/utils";

export interface CopyableSectionHeaderProps {
  title: string;
  copyText?: string;
  copyLabel?: string;
  className?: string;
}

/** Section title with an inline copy control when copyText is provided. */
export function CopyableSectionHeader({
  title,
  copyText,
  copyLabel,
  className,
}: CopyableSectionHeaderProps) {
  const text = copyText?.trim() ?? "";
  const label = copyLabel ?? `Copy ${title.toLowerCase()}`;

  return (
    <div className={cn("mb-2 flex items-center justify-between gap-2", className)}>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      {text ? <CopyButton text={text} label={label} className="h-7 w-7 shrink-0" /> : null}
    </div>
  );
}
