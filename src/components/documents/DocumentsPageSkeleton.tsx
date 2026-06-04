"use client";

import { Skeleton } from "@/components/ui/skeleton";
import type { PreprocessTableVariant } from "@/lib/preprocessUserCopy";

const TABLE_ROW_COUNT = 8;

const DocumentsPageSkeleton = ({
  variant = "user",
}: {
  variant?: PreprocessTableVariant;
}) => {
  const isAdmin = variant === "admin";
  const summaryCount = isAdmin ? 7 : 3;

  return (
    <div className="flex h-full min-h-0 flex-col space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </div>

      <div
        className={
          isAdmin
            ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7"
            : "grid grid-cols-2 gap-3 sm:grid-cols-3"
        }
      >
        {Array.from({ length: summaryCount }).map((_, i) => (
          <div key={i} className="rounded-md border bg-secondary/30 px-3 py-2 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-12" />
          </div>
        ))}
      </div>

      <div className="rounded-md border overflow-hidden">
        <div className="flex gap-4 border-b bg-muted/30 px-4 py-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 flex-1 max-w-[8rem]" />
        </div>
        {Array.from({ length: TABLE_ROW_COUNT }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border/50 px-4 py-3 last:border-0"
          >
            <Skeleton className="h-4 w-32 max-w-[30%]" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-8" />
            {isAdmin ? <Skeleton className="h-4 w-16" /> : null}
            <Skeleton className="h-2 flex-1 max-w-[6rem] rounded-full" />
            <Skeleton className="h-8 w-8 rounded-md ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default DocumentsPageSkeleton;
