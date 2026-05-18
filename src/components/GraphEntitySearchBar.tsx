"use client";

import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ArrowRight, Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface GraphEntitySearchBarProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchThreshold: number;
  onSearchThresholdChange: (threshold: number) => void;
  onSearch: () => void;
  loading?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  matchesPanel?: React.ReactNode;
}

const GraphEntitySearchBar: React.FC<GraphEntitySearchBarProps> = ({
  searchQuery,
  onSearchQueryChange,
  searchThreshold,
  onSearchThresholdChange,
  onSearch,
  loading,
  expanded = false,
  onExpandedChange,
  matchesPanel,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const canSearch = searchQuery.trim().length >= 2;

  useEffect(() => {
    if (expanded) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
  }, [expanded]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && canSearch) {
      e.preventDefault();
      onSearch();
    }
    if (e.key === "Escape") {
      onExpandedChange?.(false);
    }
  };

  const setThreshold = (value: number) => {
    onSearchThresholdChange(Math.min(1, Math.max(0, value)));
  };

  return (
    <Popover open={expanded} onOpenChange={onExpandedChange} modal={false}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={expanded ? "secondary" : "outline"}
          size="icon"
          className="h-9 w-9 shrink-0"
          data-graph-search
          title={expanded ? "Close search" : "Search entities"}
          aria-expanded={expanded}
        >
          <Search className="h-4 w-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        collisionPadding={16}
        className={cn(
          "z-[200] w-[min(26rem,calc(100vw-3rem))] overflow-hidden p-0",
          "rounded-lg border border-border/60 bg-background shadow-lg"
        )}
        data-graph-search
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex h-9 items-center gap-1 border-b border-border/60 px-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => onExpandedChange?.(false)}
            title="Close search"
          >
            <Search className="h-4 w-4" />
          </Button>

          <Input
            ref={inputRef}
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search entities…"
            className="h-8 min-w-0 flex-1 rounded-none border-0 bg-transparent px-1 text-sm shadow-none outline-none focus:border-0 focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            aria-label="Search entity names"
          />

          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                title="Match sensitivity"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="sr-only">Match threshold</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="z-[210] w-80" data-graph-search>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Match threshold</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Higher values require closer name matches. Applied when you search.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Slider
                    min={0}
                    max={1}
                    step={0.05}
                    value={[searchThreshold]}
                    onValueChange={([v]) => setThreshold(v)}
                    className="graph-control-range flex-1"
                  />
                  <Input
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={searchThreshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="h-8 w-16 shrink-0 font-mono text-xs"
                    aria-label="Threshold value"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            type="button"
            variant="default"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onSearch}
            disabled={loading || !canSearch}
            title="Search"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {matchesPanel ? (
          <div className="max-h-60 overflow-y-auto overscroll-contain px-2 py-2 scroll-smooth [-webkit-overflow-scrolling:touch]">
            {matchesPanel}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
};

export default GraphEntitySearchBar;
