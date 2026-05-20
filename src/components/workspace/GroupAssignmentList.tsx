"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

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
  maxHeightClass?: string;
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
  maxHeightClass = "max-h-52",
  showSearchThreshold = 6,
}: GroupAssignmentListProps) {
  const [query, setQuery] = useState("");
  const showSearch = items.length >= showSearchThreshold;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q)
    );
  }, [items, query]);

  return (
    <div className="space-y-2">
      {showSearch && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 pl-8 text-sm"
            disabled={disabled}
          />
        </div>
      )}
      <ScrollArea className={cn("rounded-md border", maxHeightClass)}>
        <ul className="p-2 space-y-0.5">
          {filtered.length === 0 ? (
            <li className="px-2 py-6 text-center text-xs text-muted-foreground">
              {query.trim() ? "No matches." : emptyMessage}
            </li>
          ) : (
            filtered.map((item) => {
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
