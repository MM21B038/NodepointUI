"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface DirectoryCardSkeletonProps {
  className?: string;
  statCount?: number;
  showFooterActions?: number;
  showTag?: boolean;
  showDescription?: boolean;
}

export function DirectoryCardSkeleton({
  className,
  statCount = 4,
  showFooterActions = 2,
  showTag = true,
  showDescription = true,
}: DirectoryCardSkeletonProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm",
        className
      )}
    >
      <Skeleton className="h-1 w-full rounded-none" />

      <div className="shrink-0 border-b border-border/50 bg-gradient-to-b from-muted/30 via-muted/10 to-transparent px-4 pb-3 pt-3.5">
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-5 w-3/5" />
                <Skeleton className="h-4 w-24 rounded-full" />
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {showTag ? (
                  <Skeleton className="h-5 w-14 rounded-md" />
                ) : null}
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </div>
          </div>
        </div>
        {showDescription ? (
          <Skeleton className="mt-2 h-10 w-full rounded-md" />
        ) : null}
      </div>

      <div className="flex flex-col gap-2 p-3 pt-2.5">
        {statCount === 1 ? (
          <Skeleton className="h-8 w-full rounded-md" />
        ) : (
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/50 bg-muted/20 p-2">
            {Array.from({ length: statCount }).map((_, i) => (
              <Skeleton key={i} className="h-8 rounded-md" />
            ))}
          </div>
        )}
        <div className="space-y-2">
          {Array.from({ length: showFooterActions }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default DirectoryCardSkeleton;
