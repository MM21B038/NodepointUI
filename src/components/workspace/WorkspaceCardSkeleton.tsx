"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface WorkspaceCardSkeletonProps {
  className?: string;
}

const WorkspaceCardSkeleton = ({ className }: WorkspaceCardSkeletonProps) => {
  return (
    <div
      className={cn(
        "flex min-h-[280px] flex-col justify-between rounded-lg border bg-card p-4 shadow-md",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Skeleton className="h-6 w-6 shrink-0 rounded-md" />
        <Skeleton className="h-6 flex-1 max-w-[70%]" />
        <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <Skeleton className="h-9 w-full rounded-md" />
        <Skeleton className="h-9 w-full rounded-md" />
        <div className="mt-1 space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkspaceCardSkeleton;
