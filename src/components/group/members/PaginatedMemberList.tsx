"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GroupTag, WorkspacePagePagination } from "@/database/workspaceStorage";
import { groupMemberEmptyMessage, groupTagTone } from "@/lib/groupTag";
import { cn } from "@/lib/utils";

interface PaginatedMemberListProps {
  pagination: WorkspacePagePagination;
  onPrevious: () => void;
  onNext: () => void;
  children: React.ReactNode;
  tag?: GroupTag;
  emptyMessage?: string;
  isEmpty?: boolean;
}

export function PaginatedMemberList({
  pagination,
  onPrevious,
  onNext,
  children,
  tag,
  emptyMessage,
  isEmpty = false,
}: PaginatedMemberListProps) {
  const showPagination = pagination.total_pages > 1;
  const message =
    emptyMessage ?? (tag ? groupMemberEmptyMessage(tag) : "No members yet.");
  const tone = tag ? groupTagTone(tag) : null;

  return (
    <div className="space-y-3">
      {isEmpty ? (
        <div
          className={cn(
            "rounded-md border border-dashed px-3 py-6 text-center",
            tone ? cn(tone.border, tone.pill) : "border-border/60"
          )}
        >
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
      {showPagination ? (
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-xs text-muted-foreground">
            Page {pagination.page} of {pagination.total_pages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={onPrevious}
              disabled={!pagination.has_previous}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={onNext}
              disabled={!pagination.has_next}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
