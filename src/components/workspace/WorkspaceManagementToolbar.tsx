"use client";

import {
  ChevronLeft,
  ChevronRight,
  FolderCog,
  FolderKanban,
  FolderPlus,
  Search,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
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
import {
  directoryCreateActionClass,
  directoryNavActionClass,
  directorySearchInputClass,
  directorySelectionBarClass,
  directoryTitleClass,
  directoryTitleIconClass,
  directoryToolbarClass,
  directoryToolbarDividerClass,
  directoryToolbarRowClass,
  directoryToolbarTitleClusterClass,
} from "@/components/directory/directoryPageStyles";

interface WorkspaceManagementToolbarProps {
  onOpenCreateWorkspace: () => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  groupFilter: string;
  onGroupFilterChange: (value: string) => void;
  groupFilterItems: { key: string; label: string }[];
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
  searchTerm,
  onSearchTermChange,
  groupFilter,
  onGroupFilterChange,
  groupFilterItems,
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
  const navigate = useNavigate();
  const showPagination = totalPages > 1;
  const selectionIndeterminate = someSelected && !allDisplayedSelected;

  return (
    <div className={directoryToolbarClass}>
      {someSelected && onBulkDelete && (
        <div className={directorySelectionBarClass}>
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
      <div className={directoryToolbarRowClass}>
        <div className={directoryToolbarTitleClusterClass}>
          <span className={directoryTitleIconClass("workspace")}>
            <FolderCog className="h-4 w-4" />
          </span>
          <h1 className={directoryTitleClass()}>Workspaces</h1>
          <span className={directoryToolbarDividerClass} aria-hidden />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={directoryCreateActionClass("workspace")}
            onClick={onOpenCreateWorkspace}
          >
            <FolderPlus className="h-3.5 w-3.5" />
            New workspace
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={directoryNavActionClass("group")}
            onClick={() => navigate("/group-management")}
          >
            <FolderKanban className="h-3.5 w-3.5" />
            Groups
            {groupFilterItems.length > 0 && (
              <span className="tabular-nums text-muted-foreground">
                ({groupFilterItems.length})
              </span>
            )}
          </Button>
        </div>

        <div className="relative min-w-[12rem] flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Label htmlFor="search-workspace" className="sr-only">
            Search workspaces
          </Label>
          <Input
            id="search-workspace"
            placeholder="Search by name, tag, or description…"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className={directorySearchInputClass}
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
              {groupFilterItems.map(({ key, label }) => (
                <SelectItem key={key} value={key}>
                  In group: {label}
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
      {isSearchActive && groupFilter === "all" && (
        <p className="text-[11px] text-muted-foreground pl-0.5">
          Search filters all workspace names.
        </p>
      )}
    </div>
  );
};

export default WorkspaceManagementToolbar;
