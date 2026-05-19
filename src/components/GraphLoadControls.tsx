"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GraphControlSlider } from "@/components/GraphControlSlider";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import type { EntityTypeEntry } from "@/database/workspaceStorage";
import { KB_DEFAULT_LIMIT, KB_MAX_LIMIT } from "@/database/workspaceStorage";
import { cn } from "@/lib/utils";
import { colorScale } from "./InteractiveGraphVisualization";

export interface GraphLoadParams {
  depth: number;
  limit: number;
}

interface GraphLoadControlsProps {
  params: GraphLoadParams;
  onParamsChange: (params: GraphLoadParams) => void;
  entityTypes: EntityTypeEntry[];
  selectedEntityTypes: Set<string>;
  onSelectedEntityTypesChange: (types: Set<string>) => void;
  onApply: () => void;
  onClearAll: () => void;
  loading?: boolean;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Max node limit (per workspace when limitPerWorkspace). Defaults to KB_MAX_LIMIT. */
  limitMax?: number;
  /** Shown as default in the limit label. Defaults to KB_DEFAULT_LIMIT. */
  limitDefaultHint?: number;
  /** When true, limit applies per starred workspace (flagged scope). */
  limitPerWorkspace?: boolean;
}

export const GraphLoadControls: React.FC<GraphLoadControlsProps> = ({
  params,
  onParamsChange,
  entityTypes,
  selectedEntityTypes,
  onSelectedEntityTypesChange,
  onApply,
  onClearAll,
  loading,
  className,
  open: openProp,
  onOpenChange,
  limitMax = KB_MAX_LIMIT,
  limitDefaultHint = KB_DEFAULT_LIMIT,
  limitPerWorkspace = false,
}) => {
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp ?? openInternal;
  const setOpen = onOpenChange ?? setOpenInternal;
  const sortedTypes = [...entityTypes].sort((a, b) => b.count - a.count);
  const sliderMin = Math.min(10, limitMax);

  useEffect(() => {
    if (params.limit > limitMax) {
      onParamsChange({ depth: params.depth, limit: limitMax });
    }
  }, [limitMax, params.limit, params.depth, onParamsChange]);

  const setDepth = (depth: number) => {
    onParamsChange({ ...params, depth: Math.min(5, Math.max(1, depth)) });
  };

  const setLimit = (limit: number) => {
    onParamsChange({
      ...params,
      limit: Math.min(limitMax, Math.max(1, Math.floor(limit))),
    });
  };

  const handleTypeChange = (type: string, checked: boolean) => {
    const next = new Set(selectedEntityTypes);
    if (checked) next.add(type);
    else next.delete(type);
    onSelectedEntityTypesChange(next);
  };

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      data-graph-controls
      data-kb-overlay
      className={cn(
        "pointer-events-auto isolate flex max-h-[var(--kb-bottom-overlay-max-h)] min-h-0 w-full flex-col overflow-hidden rounded-lg border bg-background/95 shadow-lg backdrop-blur-sm",
        className
      )}
    >
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className="flex h-9 w-full shrink-0 items-center justify-between gap-2 px-3 py-2"
        >
          <span className="flex items-center gap-2 text-xs font-medium">
            <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
            Graph load
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 opacity-60 transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="flex min-h-0 flex-1 flex-col overflow-hidden data-[state=closed]:hidden">
        <div
          className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-3 pb-2 scroll-smooth overscroll-contain [-webkit-overflow-scrolling:touch]"
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Traversal depth</Label>
              <span className="font-mono text-xs tabular-nums">{params.depth}</span>
            </div>
            <GraphControlSlider
              min={1}
              max={5}
              step={1}
              value={params.depth}
              onChange={setDepth}
              aria-label="Traversal depth"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="graph-load-limit" className="text-xs text-muted-foreground">
              {limitPerWorkspace
                ? `Node limit per workspace (default ${limitDefaultHint}, max ${limitMax})`
                : `Node limit (default ${limitDefaultHint}, max ${limitMax})`}
            </Label>
            <Input
              id="graph-load-limit"
              type="number"
              min={1}
              max={limitMax}
              value={params.limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="h-8 font-mono text-xs"
            />
            <GraphControlSlider
              min={sliderMin}
              max={limitMax}
              step={Math.max(1, Math.floor(limitMax / 50))}
              value={Math.min(params.limit, limitMax)}
              onChange={setLimit}
              aria-label="Node limit"
            />
          </div>

          <div className="border-t border-border/60 pt-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Label className="text-xs font-medium">Entity types</Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={() =>
                    onSelectedEntityTypesChange(new Set(sortedTypes.map((t) => t.type)))
                  }
                  disabled={sortedTypes.length === 0}
                >
                  All
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => onSelectedEntityTypesChange(new Set())}
                  disabled={selectedEntityTypes.size === 0}
                >
                  None
                </Button>
              </div>
            </div>
            <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
              {sortedTypes.length === 0 ? (
                <p className="text-xs text-muted-foreground">No entity types in this scope.</p>
              ) : (
                sortedTypes.map(({ type, count }) => (
                  <div key={type} className="flex items-center gap-2">
                    <Checkbox
                      id={`graph-load-type-${type}`}
                      checked={selectedEntityTypes.has(type)}
                      onCheckedChange={(checked) => handleTypeChange(type, checked === true)}
                    />
                    <Label
                      htmlFor={`graph-load-type-${type}`}
                      className="flex flex-1 cursor-pointer items-center justify-between gap-2 text-xs"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span
                          className={cn("h-2 w-2 shrink-0 rounded-full", colorScale(type))}
                        />
                        <span className="truncate">{type}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {count.toLocaleString()}
                      </span>
                    </Label>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-border/60 px-3 py-3">
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={onApply}
            disabled={loading || selectedEntityTypes.size === 0}
          >
            Load graph
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={onClearAll}
            disabled={loading}
          >
            Clear all filters
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
