"use client";

import { useEffect, useState } from "react";
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
  formatGroupLabel,
  formatGroupTag,
  groupSearchText,
  groupTagTone,
} from "@/lib/groupTag";
import { metaDescription } from "@/lib/resourceMeta";

export interface GroupOption {
  name: string;
  tag: GroupTag;
  description?: string | null;
  member_count: number;
}

interface GroupComboboxProps {
  groups: GroupOption[];
  value: string | null;
  onSelect: (name: string) => void;
  disabled?: boolean;
  className?: string;
}

export default function GroupCombobox({
  groups,
  value,
  onSelect,
  disabled,
  className,
}: GroupComboboxProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(value ?? "");

  useEffect(() => {
    setSelected(value ?? "");
  }, [value]);

  const active = groups.find((g) => g.name === selected);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-8 justify-between gap-1 px-3 text-xs font-normal",
            "w-[10rem] border-input bg-background",
            className
          )}
        >
          <span className="flex min-w-0 items-center gap-1 truncate">
            <Users className="h-3 w-3 shrink-0 opacity-70" />
            {active ? (
              <span className="truncate">
                {formatGroupLabel(active.name, active.member_count, active.tag)}
              </span>
            ) : (
              <span className="text-muted-foreground">Select group</span>
            )}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[12rem] p-0" align="start">
        <Command
          filter={(itemValue, search) => {
            if (!search) return 1;
            const group = groups.find((g) => g.name === itemValue);
            const haystack = group ? groupSearchText(group) : itemValue.toLowerCase();
            return haystack.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Search group…" className="h-8 text-xs" />
          <CommandList className="max-h-[180px] hide-scrollbar">
            <CommandEmpty className="py-4 text-xs">No group found.</CommandEmpty>
            <CommandGroup>
              {groups.map((g) => (
                <CommandItem
                  key={g.name}
                  value={g.name}
                  className="text-xs"
                  onSelect={(currentValue) => {
                    onSelect(currentValue);
                    setSelected(currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-3.5 w-3.5",
                      selected === g.name ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="min-w-0 truncate">{g.name}</span>
                  <span className={cn("shrink-0", groupTagTone(g.tag).text)}>
                    · {formatGroupTag(g.tag)}
                  </span>
                  {metaDescription(g) && (
                    <span className="hidden min-w-0 truncate text-muted-foreground sm:inline">
                      · {metaDescription(g)}
                    </span>
                  )}
                  <span className="ml-auto shrink-0 text-muted-foreground">
                    ({g.member_count})
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
