"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { EntitySearchMatch } from "@/database/workspaceStorage";
import { cn } from "@/lib/utils";

interface SearchNodesPanelProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchThreshold: number;
  onSearchThresholdChange: (threshold: number) => void;
  depth: number;
  limit: number;
  matches: EntitySearchMatch[];
  isSearchMode: boolean;
  onRunSearch: () => void;
  onClearSearch: () => void;
  onHighlightMatch?: (nodeId: string, workspace?: string) => void;
  onClose: () => void;
  loading?: boolean;
}

const SearchNodesPanel: React.FC<SearchNodesPanelProps> = ({
  searchQuery,
  onSearchQueryChange,
  searchThreshold,
  onSearchThresholdChange,
  depth,
  limit,
  matches,
  isSearchMode,
  onRunSearch,
  onClearSearch,
  onHighlightMatch,
  onClose,
  loading,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim().length >= 2) {
      onRunSearch();
    }
  };

  return (
    <Card className="h-full border-none bg-background/80 shadow-lg backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center">
          <Search className="mr-2 h-5 w-5" />
          <CardTitle className="text-xl">Search entities</CardTitle>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} title="Close Search Panel">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex h-[calc(100%-60px)] flex-col gap-4 overflow-hidden p-4">
        <div>
          <Label htmlFor="entity-search" className="sr-only">
            Search entity name
          </Label>
          <Input
            id="entity-search"
            placeholder="Fuzzy search by name (min 2 chars)…"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="mt-1 border-primary/20 bg-background/50"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Match threshold</Label>
            <span className="font-mono text-xs text-muted-foreground">
              {searchThreshold.toFixed(2)}
            </span>
          </div>
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={[searchThreshold]}
            onValueChange={([v]) => onSearchThresholdChange(v)}
            className="graph-control-range"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Uses graph load depth <span className="font-mono">{depth}</span> and limit{" "}
          <span className="font-mono">{limit}</span> from Graph load panel.
        </p>

        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={onRunSearch}
            disabled={loading || searchQuery.trim().length < 2}
          >
            Search
          </Button>
          {isSearchMode && (
            <Button variant="outline" onClick={onClearSearch} disabled={loading}>
              Clear
            </Button>
          )}
        </div>

        {matches.length > 0 && (
          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border/60 p-2">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Matches ({matches.length})
            </p>
            <ul className="space-y-1">
              {matches.map((m) => (
                <li key={`${m.workspace ?? ""}-${m.id}`}>
                  <button
                    type="button"
                    className={cn(
                      "w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60",
                      "flex items-center justify-between gap-2"
                    )}
                    onClick={() => onHighlightMatch?.(m.id, m.workspace)}
                  >
                    <span className="truncate font-medium">{m.name}</span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {m.score.toFixed(2)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SearchNodesPanel;
