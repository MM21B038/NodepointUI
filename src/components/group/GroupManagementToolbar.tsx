"use client";

import {
  ChevronLeft,
  ChevronRight,
  FolderPlus,
  Search,
  Trash2,
  FolderKanban,
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
import type { GroupTag } from "@/database/workspaceStorage";
import { GROUP_TAGS } from "@/database/workspaceStorage";
import { GroupTagDot } from "@/components/group/GroupTagBadge";
import { formatGroupTag } from "@/lib/groupTag";
import {
  directoryCreateActionClass,
  directorySearchInputClass,
  directorySelectionBarClass,
  directoryTitleClass,
  directoryTitleIconClass,
  directoryToolbarClass,
  directoryToolbarDividerClass,
  directoryToolbarRowClass,
  directoryToolbarTitleClusterClass,
} from "@/components/directory/directoryPageStyles";

interface GroupManagementToolbarProps {
  onOpenCreateGroup: () => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  tagFilter: GroupTag | "all";
  onTagFilterChange: (value: GroupTag | "all") => void;
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

const GroupManagementToolbar = ({
  onOpenCreateGroup,
  searchTerm,
  onSearchTermChange,
  tagFilter,
  onTagFilterChange,
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
}: GroupManagementToolbarProps) => {
  const showPagination = totalPages > 1;
  const selectionIndeterminate = someSelected && !allDisplayedSelected;

  return (
    <div className={directoryToolbarClass}>
      {someSelected && onBulkDelete && (
        <div className={directorySelectionBarClass}>
          {onToggleSelectAllDisplayed && (
            <Checkbox
              checked={
                allDisplayedSelected
                  ? true
                  : selectionIndeterminate
                    ? "indeterminate"
                    : false
              }
              onCheckedChange={(checked) => onToggleSelectAllDisplayed(checked === true)}
              aria-label="Select all groups on this page"
              disabled={isDeleting}
            />
          )}
          <span className="text-sm font-medium">{selectedCount} selected</span>
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
          <span className={directoryTitleIconClass("group")}>
            <FolderKanban className="h-4 w-4" />
          </span>
          <h1 className={directoryTitleClass()}>Groups</h1>
          <span className={directoryToolbarDividerClass} aria-hidden />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={directoryCreateActionClass("group")}
            onClick={onOpenCreateGroup}
          >
            <FolderPlus className="h-3.5 w-3.5" />
            New group
          </Button>
        </div>

        <div className="relative min-w-[12rem] flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Label htmlFor="search-group" className="sr-only">
            Search groups
          </Label>
          <Input
            id="search-group"
            placeholder="Search by name, type, or description…"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className={directorySearchInputClass}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Label htmlFor="group-tag-filter" className="sr-only">
            Filter by type
          </Label>
          <Select
            value={tagFilter}
            onValueChange={(value) => onTagFilterChange(value as GroupTag | "all")}
          >
            <SelectTrigger id="group-tag-filter" className="h-9 w-[10rem]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {GROUP_TAGS.map((tag) => (
                <SelectItem key={tag} value={tag}>
                  <span className="flex items-center gap-2">
                    <GroupTagDot tag={tag} />
                    {formatGroupTag(tag)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {totalItems} group{totalItems === 1 ? "" : "s"}
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
          Search matches group name, tag, and description.
        </p>
      )}
    </div>
  );
};

export default GroupManagementToolbar;
