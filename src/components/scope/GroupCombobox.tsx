"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { GroupTag } from "@/database/workspaceStorage";
import {
  formatGroupTag,
  groupSearchText,
  groupTagTone,
} from "@/lib/groupTag";
import {
  duplicateNamesInList,
  formatScopedResourceLabel,
  groupResourceKey,
  listHasMultipleOwners,
} from "@/lib/ownerScope";
import { metaDescription } from "@/lib/resourceMeta";

export interface GroupOption {
  id?: number;
  name: string;
  owner_id?: number;
  owner_username?: string | null;
  tag: GroupTag;
  description?: string | null;
  member_count: number;
}

interface GroupComboboxProps {
  groups: GroupOption[];
  value: string | null;
  valueOwnerId?: number | null;
  onSelect: (group: GroupOption) => void;
  disabled?: boolean;
  className?: string;
}

export default function GroupCombobox({
  groups,
  value,
  valueOwnerId,
  onSelect,
  disabled,
  className,
}: GroupComboboxProps) {
  const [open, setOpen] = useState(false);
  const duplicateNames = useMemo(() => duplicateNamesInList(groups), [groups]);
  const multiOwnerList = useMemo(() => listHasMultipleOwners(groups), [groups]);
  const hasAmbiguousNames = duplicateNames.size > 0 || multiOwnerList;

  const active = groups.find(
    (g) =>
      g.name === value &&
      (valueOwnerId == null || g.owner_id === valueOwnerId)
  );

  const selectedKey = active
    ? groupResourceKey(active.name, active.owner_id)
    : value ?? "";

  const activeLabel = active
    ? formatScopedResourceLabel(active.name, active.owner_username, {
        duplicateNames,
        multiOwnerList,
      })
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-9 min-w-[11rem] max-w-[16rem] justify-between gap-2 bg-card px-3 text-foreground hover:bg-card/90",
            className
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-1 truncate">
            <Users className="h-3.5 w-3.5 shrink-0 opacity-70" />
            {active ? (
              <span className="flex min-w-0 flex-1 flex-col items-start leading-tight">
                <span
                  className="w-full truncate text-left text-sm font-medium"
                  title={activeLabel ?? active.name}
                >
                  {activeLabel ?? active.name}
                </span>
                <span className="truncate text-[10px] text-muted-foreground">
                  {formatGroupTag(active.tag)} · {active.member_count}
                </span>
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Select group…</span>
            )}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[14rem] max-w-[20rem] p-0"
        align="start"
      >
        <Command
          filter={(itemValue, search) => {
            if (!search) return 1;
            const group = groups.find(
              (g) => groupResourceKey(g.name, g.owner_id) === itemValue
            );
            const haystack = group ? groupSearchText(group) : itemValue.toLowerCase();
            return haystack.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput
            placeholder={
              hasAmbiguousNames ? "Search name or owner…" : "Search group…"
            }
            className="h-9"
          />
          <CommandList className="max-h-[220px] hide-scrollbar">
            <CommandEmpty className="py-6 text-xs text-muted-foreground">
              No group found.
            </CommandEmpty>
            <CommandGroup
              heading={
                hasAmbiguousNames
                  ? "Choose group · owner"
                  : undefined
              }
            >
              {groups.map((g) => {
                const key = groupResourceKey(g.name, g.owner_id);
                const rowLabel = formatScopedResourceLabel(
                  g.name,
                  g.owner_username,
                  { duplicateNames, multiOwnerList }
                );
                const isSelected = selectedKey === key;
                return (
                  <CommandItem
                    key={key}
                    value={key}
                    className="items-center gap-2 py-2"
                    onSelect={() => {
                      onSelect(g);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span
                        className="truncate text-sm font-medium leading-none"
                        title={rowLabel}
                      >
                        {rowLabel}
                      </span>
                      <span className="text-[11px] leading-none text-muted-foreground">
                        <span className={cn(groupTagTone(g.tag).text)}>
                          {formatGroupTag(g.tag)}
                        </span>
                        {metaDescription(g)
                          ? ` · ${metaDescription(g)}`
                          : null}
                      </span>
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      ({g.member_count})
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
