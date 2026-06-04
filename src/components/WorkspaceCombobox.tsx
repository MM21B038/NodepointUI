"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, User } from "lucide-react";
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
import {
  duplicateNamesInList,
  shouldShowOwnerInScopedPicker,
  workspaceResourceKey,
} from "@/lib/ownerScope";

export interface WorkspaceOption {
  name: string;
  owner_id?: number;
  owner_username?: string | null;
}

interface WorkspaceComboboxProps {
  workspaces: WorkspaceOption[];
  value: string | null;
  valueOwnerId?: number | null;
  onSelect: (workspace: WorkspaceOption) => void;
  disabled?: boolean;
  className?: string;
}

const WorkspaceCombobox: React.FC<WorkspaceComboboxProps> = ({
  workspaces,
  value,
  valueOwnerId,
  onSelect,
  disabled,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const duplicateNames = useMemo(
    () => duplicateNamesInList(workspaces),
    [workspaces]
  );
  const hasAmbiguousNames = duplicateNames.size > 0;

  const nameMatches = useMemo(
    () => (value ? workspaces.filter((w) => w.name === value) : []),
    [workspaces, value]
  );

  const active = useMemo(() => {
    if (!value) return undefined;
    const byOwner = nameMatches.find(
      (w) => valueOwnerId == null || w.owner_id === valueOwnerId
    );
    if (byOwner) return byOwner;
    if (nameMatches.length === 1) return nameMatches[0];
    return undefined;
  }, [value, valueOwnerId, nameMatches]);

  const selectedKey = active
    ? workspaceResourceKey(active.name, active.owner_id)
    : value ?? "";

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
          <span className="flex min-w-0 flex-1 flex-col items-start leading-tight">
            {active ? (
              <>
                <span className="w-full truncate text-left text-sm font-medium">
                  {active!.name}
                </span>
                {hasAmbiguousNames &&
                shouldShowOwnerInScopedPicker(
                  duplicateNames,
                  active!.owner_username
                ) ? (
                  <span className="flex w-full min-w-0 items-center gap-1 truncate text-[10px] text-muted-foreground">
                    <User className="h-2.5 w-2.5 shrink-0 opacity-70" />
                    <span className="truncate">{active!.owner_username}</span>
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-sm text-muted-foreground">
                Select workspace…
              </span>
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
            const ws = workspaces.find(
              (w) => workspaceResourceKey(w.name, w.owner_id) === itemValue
            );
            const haystack = ws
              ? [ws.name, ws.owner_username ?? ""]
                  .join(" ")
                  .toLowerCase()
              : itemValue.toLowerCase();
            return haystack.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput
            placeholder={
              hasAmbiguousNames
                ? "Search name or owner…"
                : "Search workspace…"
            }
            className="h-9"
          />
          <CommandList className="max-h-[220px] hide-scrollbar">
            <CommandEmpty className="py-6 text-xs text-muted-foreground">
              No workspace found.
            </CommandEmpty>
            <CommandGroup
              heading={
                hasAmbiguousNames
                  ? "Same name — choose by owner"
                  : undefined
              }
            >
              {workspaces.map((ws) => {
                const key = workspaceResourceKey(ws.name, ws.owner_id);
                const showOwner = shouldShowOwnerInScopedPicker(
                  duplicateNames,
                  ws.owner_username
                );
                const isSelected = selectedKey === key;
                return (
                  <CommandItem
                    key={key}
                    value={key}
                    className="items-center gap-2 py-2"
                    onSelect={() => {
                      onSelect(ws);
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
                      <span className="truncate text-sm font-medium leading-none">
                        {ws.name}
                      </span>
                      {showOwner ? (
                        <span className="flex min-w-0 items-center gap-1 text-[11px] leading-none text-muted-foreground">
                          <User
                            className="h-3 w-3 shrink-0 opacity-70"
                            aria-hidden
                          />
                          <span className="truncate">{ws.owner_username}</span>
                        </span>
                      ) : null}
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
};

export default WorkspaceCombobox;
