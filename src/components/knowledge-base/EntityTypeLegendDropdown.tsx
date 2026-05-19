"use client";

import { Palette, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { colorScale } from "@/components/InteractiveGraphVisualization";
import { cn } from "@/lib/utils";

export interface EntityTypeLegendItem {
  type: string;
  count: number;
}

interface EntityTypeLegendDropdownProps {
  items: EntityTypeLegendItem[];
  disabled?: boolean;
  className?: string;
}

export function EntityTypeLegendDropdown({
  items,
  disabled,
  className,
}: EntityTypeLegendDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn("h-9 gap-1.5 px-2.5 text-xs", className)}
          data-kb-overlay
          title="Entity type legend"
        >
          <Palette className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">Legend</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={6}
        collisionPadding={16}
        data-kb-overlay
        className="z-[220] w-[min(17rem,calc(100vw-2rem))] p-0"
      >
        <div
          className="min-h-[3rem] max-h-[min(280px,calc(100vh-10rem))] overflow-y-auto overscroll-contain p-2 hide-scrollbar"
          onWheel={(e) => e.stopPropagation()}
        >
          {items.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              No entity types in this scope.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {items.map(({ type, count }) => (
                <li
                  key={type}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full border border-border/40"
                      style={{ backgroundColor: colorScale(type) }}
                      aria-hidden
                    />
                    <span className="truncate text-xs font-medium" title={type}>
                      {type}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                    {count.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
