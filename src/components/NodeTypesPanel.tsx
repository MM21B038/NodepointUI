"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Network, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EntityTypeEntry } from "@/database/workspaceStorage";
import { cn } from "@/lib/utils";
import { colorScale } from "./InteractiveGraphVisualization";

interface NodeTypesPanelProps {
  entityTypes: EntityTypeEntry[];
  selectedNodeTypes: Set<string>;
  onSelectedNodeTypesChange: (types: Set<string>) => void;
  onApply: () => void;
  onClose: () => void;
  loading?: boolean;
}

const NodeTypesPanel: React.FC<NodeTypesPanelProps> = ({
  entityTypes,
  selectedNodeTypes,
  onSelectedNodeTypesChange,
  onApply,
  onClose,
  loading,
}) => {
  const sortedTypes = [...entityTypes].sort((a, b) => b.count - a.count);

  const handleNodeTypeChange = (type: string, checked: boolean) => {
    const next = new Set(selectedNodeTypes);
    if (checked) next.add(type);
    else next.delete(type);
    onSelectedNodeTypesChange(next);
  };

  const handleSelectAll = () => {
    onSelectedNodeTypesChange(new Set(sortedTypes.map((t) => t.type)));
  };

  const handleClearAll = () => {
    onSelectedNodeTypesChange(new Set());
  };

  return (
    <Card className="h-full border-none bg-background/80 shadow-lg backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center">
          <Network className="mr-2 h-5 w-5" />
          <CardTitle className="text-xl">Node Types</CardTitle>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} title="Close Node Types Panel">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex h-[calc(100%-60px)] flex-col overflow-hidden p-4">
        <div className="mb-4 flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            disabled={
              sortedTypes.length === 0 || selectedNodeTypes.size === sortedTypes.length
            }
            className="flex-1"
          >
            Select All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            disabled={selectedNodeTypes.size === 0}
            className="flex-1"
          >
            Clear All
          </Button>
        </div>

        <ScrollArea className="min-h-0 flex-1 pr-3">
          {sortedTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entity types in this scope.</p>
          ) : (
            <div className="space-y-3">
              {sortedTypes.map(({ type, count }) => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox
                    id={`node-type-${type}`}
                    checked={selectedNodeTypes.has(type)}
                    onCheckedChange={(checked) =>
                      handleNodeTypeChange(type, checked === true)
                    }
                  />
                  <Label
                    htmlFor={`node-type-${type}`}
                    className="flex flex-1 cursor-pointer items-center justify-between gap-2 text-sm font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={cn("h-3 w-3 shrink-0 rounded-full", colorScale(type))}
                      />
                      {type}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {count.toLocaleString()}
                    </span>
                  </Label>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <Button className="mt-4 shrink-0" onClick={onApply} disabled={loading || selectedNodeTypes.size === 0}>
          Apply types
        </Button>
      </CardContent>
    </Card>
  );
};

export default NodeTypesPanel;
