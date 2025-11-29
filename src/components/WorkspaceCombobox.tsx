"use client";

import React, { useState, useEffect } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

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

interface WorkspaceComboboxProps {
  workspaces: string[];
  currentWorkspace: string | null;
  onSelectWorkspace: (workspaceName: string) => void;
  disabled?: boolean;
}

const WorkspaceCombobox: React.FC<WorkspaceComboboxProps> = ({
  workspaces,
  currentWorkspace,
  onSelectWorkspace,
  disabled,
}) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentWorkspace || "");

  useEffect(() => {
    setValue(currentWorkspace || "");
  }, [currentWorkspace]);

  // Custom filter function for sequential search
  const customFilter = (itemValue: string, searchValue: string) => {
    if (!searchValue) return true; // If search is empty, show all items
    return itemValue.toLowerCase().includes(searchValue.toLowerCase());
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between bg-card text-foreground hover:bg-card/90 h-9 px-3" // Reduced height and horizontal padding
          disabled={disabled}
        >
          {value
            ? workspaces.find((workspace) => workspace === value)
            : "Select Workspace..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command filter={customFilter}>
          <CommandInput placeholder="Search workspace..." />
          <CommandList className="max-h-[180px] hide-scrollbar">
            <CommandEmpty>No workspace found.</CommandEmpty>
            <CommandGroup>
              {workspaces.map((workspace) => (
                <CommandItem
                  key={workspace}
                  value={workspace}
                  onSelect={(currentValue) => {
                    onSelectWorkspace(currentValue === value ? "" : currentValue);
                    setValue(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                  className="py-1" // Reduced vertical padding
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === workspace ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {workspace}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default WorkspaceCombobox;