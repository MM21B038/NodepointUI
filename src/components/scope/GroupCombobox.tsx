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

export interface GroupOption {
  name: string;
  workspace_count: number;
}

interface GroupComboboxProps {
  groups: GroupOption[];
  value: string | null;
  onSelect: (name: string) => void;
  disabled?: boolean;
  className?: string;
}

function formatGroupLabel(name: string, count: number) {
  return `${name}(${count})`;
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
              <span className="truncate">{formatGroupLabel(active.name, active.workspace_count)}</span>
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
            return itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
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
                  <span className="truncate">{g.name}</span>
                  <span className="ml-1 shrink-0 text-muted-foreground">
                    ({g.workspace_count})
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
