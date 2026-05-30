"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MembersPanelLayoutProps {
  list: ReactNode;
  add: ReactNode;
  className?: string;
}

export function MembersPanelLayout({ list, add, className }: MembersPanelLayoutProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-3 overflow-hidden",
        className
      )}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        {list}
      </div>
      <div className="shrink-0 border-t border-border/40 pt-3">{add}</div>
    </div>
  );
}
