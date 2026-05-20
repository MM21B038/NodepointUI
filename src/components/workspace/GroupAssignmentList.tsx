"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const LARGE_LIST_THRESHOLD = 50;
/** Max rows rendered without a search query (group members always included). */
const BROWSE_CAP = 100;
/** Max rows rendered when searching a large directory. */
const SEARCH_CAP = 200;

export interface GroupAssignmentItem {
  id: string;
  label: string;
  hint?: string;
}

interface GroupAssignmentListProps {
  items: GroupAssignmentItem[];
  selectedIds: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
  pendingId?: string | null;
  disabled?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  /** Fixed height on the scroll container (must use `h-*`, not `max-h-*`). */
  heightClass?: string;
  showSearchThreshold?: number;
}

export default function GroupAssignmentList({
  items,
  selectedIds,
  onToggle,
  pendingId = null,
  disabled = false,
  searchPlaceholder = "Search…",
  emptyMessage = "Nothing to show.",
  heightClass = "h-52",
  showSearchThreshold = 6,
}: GroupAssignmentListProps) {
  const [query, setQuery] = useState("");
  const showSearch = items.length >= showSearchThreshold;
  const isLargeList = items.length > LARGE_LIST_THRESHOLD;
  const hasSearchQuery = query.trim().length > 0;

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.label.localeCompare(b.label)),
    [items]
  );

  const { visible, matchCount, isBrowseCapped } = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (q) {
      const matches = sortedItems.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q)
      );
      const capped = matches.length > SEARCH_CAP;
      return {
        visible: matches.slice(0, SEARCH_CAP),
        matchCount: matches.length,
        isBrowseCapped: capped,
      };
    }

    if (sortedItems.length <= BROWSE_CAP) {
      return {
        visible: sortedItems,
        matchCount: sortedItems.length,
        isBrowseCapped: false,
      };
    }

    const inGroup: GroupAssignmentItem[] = [];
    const rest: GroupAssignmentItem[] = [];
    for (const item of sortedItems) {
      if (selectedIds.has(item.id)) inGroup.push(item);
      else rest.push(item);
    }
    const room = Math.max(0, BROWSE_CAP - inGroup.length);
    const visible = [...inGroup, ...rest.slice(0, room)];
    return {
      visible,
      matchCount: sortedItems.length,
      isBrowseCapped: visible.length < sortedItems.length,
    };
  }, [sortedItems, query, selectedIds]);

  const listHint = useMemo(() => {
    if (items.length === 0) return null;
    if (hasSearchQuery) {
      if (matchCount === 0) return null;
      if (isBrowseCapped) {
        return `Showing first ${SEARCH_CAP} of ${matchCount} matches — refine your search.`;
      }
      return `${matchCount} match${matchCount === 1 ? "" : "es"}`;
    }
    if (!isLargeList) return null;
    if (isBrowseCapped) {
      const inGroup = selectedIds.size;
      return inGroup > 0
        ? `Showing ${visible.length} of ${items.length} (${inGroup} in group first). Search to find any workspace.`
        : `Showing first ${visible.length} of ${items.length}. Search to find a workspace.`;
    }
    return null;
  }, [
    items.length,
    hasSearchQuery,
    matchCount,
    isBrowseCapped,
    isLargeList,
    selectedIds.size,
    visible.length,
  ]);

  return (
    <div className="space-y-2">
      {showSearch && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isLargeList
                ? `${searchPlaceholder} (${items.length} total)`
                : searchPlaceholder
            }
            className="h-8 pl-8 text-sm"
            disabled={disabled}
          />
        </div>
      )}
      {listHint != null ? (
        <p className="text-xs text-muted-foreground">{listHint}</p>
      ) : null}
      <ScrollArea
        className={cn("rounded-md border overflow-hidden", heightClass)}
      >
        <ul className="p-2 space-y-0.5">
          {visible.length === 0 ? (
            <li className="px-2 py-6 text-center text-xs text-muted-foreground">
              {hasSearchQuery ? "No matches." : emptyMessage}
            </li>
          ) : (
            visible.map((item) => {
              const checked = selectedIds.has(item.id);
              const isBusy = pendingId === item.id;
              const inputId = `assign-${item.id}`;
              return (
                <li
                  key={item.id}
                  className={cn(
                    "flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50",
                    isBusy && "opacity-60"
                  )}
                >
                  <Checkbox
                    id={inputId}
                    checked={checked}
                    disabled={disabled || !!pendingId}
                    className="mt-0.5"
                    onCheckedChange={(v) => onToggle(item.id, v === true)}
                  />
                  <Label
                    htmlFor={inputId}
                    className="min-w-0 flex-1 cursor-pointer text-sm font-normal leading-snug"
                  >
                    <span className="break-all">{item.label}</span>
                    {item.hint != null && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        {item.hint}
                      </span>
                    )}
                  </Label>
                </li>
              );
            })
          )}
        </ul>
      </ScrollArea>
    </div>
  );
}
