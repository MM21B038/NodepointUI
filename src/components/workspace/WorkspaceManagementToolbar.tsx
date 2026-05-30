"use client";

import {
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  FolderPlus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WorkspaceStats } from "@/database/workspaceStorage";

interface WorkspaceManagementToolbarProps {
  onOpenCreateWorkspace: () => void;
  onOpenManageGroups: () => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  groupFilter: string;
  onGroupFilterChange: (value: string) => void;
  groupNames: string[];
  workspaceStats: WorkspaceStats | null;
  totalItems: number;
  page: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
  isSearchActive?: boolean;
  selectedCount?: number;
  allDisplayedSelected?: boolean;
  someSelected?: boolean;
  onToggleSelectAllDisplayed?: (checked: boolean) => void;
  onBulkDelete?: () => void;
  onClearSelection?: () => void;
  isDeleting?: boolean;
}

const WorkspaceManagementToolbar = ({
  onOpenCreateWorkspace,
  onOpenManageGroups,
  searchTerm,
  onSearchTermChange,
  groupFilter,
  onGroupFilterChange,
  groupNames,
  workspaceStats,
  totalItems,
  page,
  totalPages,
  hasPrevious,
  hasNext,
  onPreviousPage,
  onNextPage,
  isSearchActive = false,
  selectedCount = 0,
  allDisplayedSelected = false,
  someSelected = false,
  onToggleSelectAllDisplayed,
  onBulkDelete,
  onClearSelection,
  isDeleting = false,
}: WorkspaceManagementToolbarProps) => {
  const showPagination = totalPages > 1;
  const selectionIndeterminate = someSelected && !allDisplayedSelected;

  return (
    <div className="shrink-0 border-b border-border/60 px-4 py-3 space-y-1.5">
      {someSelected && onBulkDelete && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
          {onToggleSelectAllDisplayed && (
            <Checkbox
              checked={allDisplayedSelected ? true : selectionIndeterminate ? "indeterminate" : false}
              onCheckedChange={(checked) => onToggleSelectAllDisplayed(checked === true)}
              aria-label="Select all workspaces on this page"
              disabled={isDeleting}
            />
          )}
          <span className="text-sm font-medium">
            {selectedCount} selected
          </span>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="h-8 gap-1.5"
            onClick={onBulkDelete}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4" />
            Delete selected
          </Button>
          {onClearSelection && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={onClearSelection}
              disabled={isDeleting}
            >
              Clear
            </Button>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold shrink-0 mr-1">Workspaces</h1>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            size="sm"
            className="h-9 gap-1.5"
            onClick={onOpenCreateWorkspace}
          >
            <FolderPlus className="h-4 w-4" />
            New workspace
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 gap-1.5"
            onClick={onOpenManageGroups}
          >
            <FolderKanban className="h-4 w-4" />
            Groups
            {groupNames.length > 0 && (
              <span className="tabular-nums text-muted-foreground">
                ({groupNames.length})
              </span>
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

        <div className="flex items-center gap-2 shrink-0">
          <Label htmlFor="group-filter" className="sr-only">
            Filter by group
          </Label>
          <Select value={groupFilter} onValueChange={onGroupFilterChange}>
            <SelectTrigger id="group-filter" className="h-9 w-[11rem]">
              <SelectValue placeholder="All workspaces" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                All workspaces
                {workspaceStats != null ? ` (${workspaceStats.total})` : ""}
              </SelectItem>
              {groupNames.map((name) => (
                <SelectItem key={name} value={name}>
                  In group: {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      {groupFilter !== "all" && !isSearchActive && (
        <p className="text-xs text-muted-foreground pl-0.5">
          Showing workspaces in group &quot;{groupFilter}&quot;.
        </p>
      )}
    </div>
  );
};

export default WorkspaceManagementToolbar;
