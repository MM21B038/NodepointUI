"use client";

import {
  ChevronLeft,
  ChevronRight,
  Flag,
  FlagOff,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { WorkspaceStats } from "@/database/workspaceStorage";

export type FlagFilter = "both" | "flagged" | "unflagged";

const FLAG_FILTER_OPTIONS: {
  value: FlagFilter;
  label: string;
  icon?: "flag" | "flagOff";
  ariaLabel: string;
  statKey?: keyof WorkspaceStats;
}[] = [
  {
    value: "both",
    label: "All",
    ariaLabel: "Show all workspaces",
    statKey: "total",
  },
  {
    value: "flagged",
    label: "Flagged",
    icon: "flag",
    ariaLabel: "Show flagged workspaces only",
    statKey: "flagged",
  },
  {
    value: "unflagged",
    label: "Unflagged",
    icon: "flagOff",
    ariaLabel: "Show unflagged workspaces only",
    statKey: "non_flagged",
  },
];

interface WorkspaceManagementToolbarProps {
  newWorkspaceName: string;
  onNewWorkspaceNameChange: (value: string) => void;
  onCreateWorkspace: () => void;
  isCreating: boolean;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  flagFilter: FlagFilter;
  onFlagFilterChange: (value: FlagFilter) => void;
  workspaceStats: WorkspaceStats | null;
  totalItems: number;
  page: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
  isSearchActive?: boolean;
}

const WorkspaceManagementToolbar = ({
  newWorkspaceName,
  onNewWorkspaceNameChange,
  onCreateWorkspace,
  isCreating,
  searchTerm,
  onSearchTermChange,
  flagFilter,
  onFlagFilterChange,
  workspaceStats,
  totalItems,
  page,
  totalPages,
  hasPrevious,
  hasNext,
  onPreviousPage,
  onNextPage,
  isSearchActive = false,
}: WorkspaceManagementToolbarProps) => {
  const showPagination = totalPages > 1;

  return (
    <div className="shrink-0 border-b border-border/60 px-4 py-3 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold shrink-0 mr-1">Workspaces</h1>

        <div className="flex items-center gap-2 min-w-0">
          <Label htmlFor="new-workspace-name" className="sr-only">
            Workspace name
          </Label>
          <Input
            id="new-workspace-name"
            placeholder="New workspace name"
            value={newWorkspaceName}
            onChange={(e) => onNewWorkspaceNameChange(e.target.value)}
            disabled={isCreating}
            className="h-9 w-[11rem] sm:w-[13rem]"
            onKeyDown={(e) => {
              if (e.key === "Enter") onCreateWorkspace();
            }}
          />
          <Button
            size="sm"
            className="h-9 shrink-0"
            onClick={onCreateWorkspace}
            disabled={isCreating || !newWorkspaceName.trim()}
          >
            {isCreating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1.5" />
                Create
              </>
            )}
          </Button>
        </div>

        <div className="relative flex-1 min-w-[12rem] max-w-md">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Label htmlFor="search-workspace" className="sr-only">
            Search workspaces
          </Label>
          <Input
            id="search-workspace"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="h-9 pl-9"
          />
        </div>

        <div
          role="group"
          aria-label="Filter by flag status"
          className="flex items-center gap-1.5 shrink-0"
        >
          <span className="text-xs text-muted-foreground hidden sm:inline whitespace-nowrap">
            Show
          </span>
          <div
            id="flag-filter"
            className="inline-flex h-9 items-center gap-0.5 rounded-md border border-input bg-muted/40 p-0.5"
          >
            {FLAG_FILTER_OPTIONS.map((option) => {
              const isActive = flagFilter === option.value;
              const count =
                workspaceStats && option.statKey
                  ? workspaceStats[option.statKey]
                  : null;
              return (
                <Button
                  key={option.value}
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={option.ariaLabel}
                  aria-pressed={isActive}
                  onClick={() => onFlagFilterChange(option.value)}
                  className={cn(
                    "h-8 gap-1 px-2.5 text-xs font-medium shadow-none",
                    isActive
                      ? "bg-background text-foreground shadow-sm hover:bg-background"
                      : "text-muted-foreground hover:text-foreground hover:bg-transparent"
                  )}
                >
                  {option.icon === "flag" && (
                    <Flag
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        isActive
                          ? "fill-amber-500 text-amber-600"
                          : "text-muted-foreground"
                      )}
                    />
                  )}
                  {option.icon === "flagOff" && (
                    <FlagOff
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        isActive ? "text-foreground" : "text-muted-foreground"
                      )}
                    />
                  )}
                  <span className={cn(option.icon && "hidden sm:inline")}>
                    {option.label}
                  </span>
                  {count !== null && (
                    <span
                      className={cn(
                        "tabular-nums",
                        option.icon && "sm:ml-0.5",
                        !option.icon && "ml-0.5"
                      )}
                    >
                      ({count})
                    </span>
                  )}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {totalItems} workspace{totalItems === 1 ? "" : "s"}
          </span>
          {showPagination && (
            <>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Page {page} of {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={onPreviousPage}
                disabled={!hasPrevious}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={onNextPage}
                disabled={!hasNext}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
      {isSearchActive && (
        <p className="text-xs text-muted-foreground pl-0.5">
          Search filters all loaded workspace names.
        </p>
      )}
    </div>
  );
};

export default WorkspaceManagementToolbar;
