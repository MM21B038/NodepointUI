"use client";

import React, { useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Network, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GraphNode } from "@/database/workspaceStorage";
import { cn } from "@/lib/utils";
import * as d3 from "d3"; // Import d3

interface NodeTypesPanelProps {
  nodes: GraphNode[];
  selectedNodeTypes: Set<string>;
  onSelectedNodeTypesChange: (types: Set<string>) => void;
  onClose: () => void;
  onFilterInteraction: () => void; // New prop
}

const NodeTypesPanel: React.FC<NodeTypesPanelProps> = ({
  nodes,
  selectedNodeTypes,
  onSelectedNodeTypesChange,
  onClose,
  onFilterInteraction,
}) => {
  const uniqueNodeTypes = useMemo(() => {
    const types = new Set(nodes.map((node) => node.type));
    return Array.from(types).sort();
  }, [nodes]);

  // Re-create the same D3 color scale used in InteractiveGraphVisualization
  const colorScale = useMemo(() => d3.scaleOrdinal(d3.schemeSet3), []);

  const handleNodeTypeChange = (type: string, checked: boolean) => {
    onSelectedNodeTypesChange((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(type);
      } else {
        newSet.delete(type);
      }
      return newSet;
    });
    onFilterInteraction(); // Notify parent about filter interaction
  };

  const handleSelectAll = () => {
    onSelectedNodeTypesChange(new Set(uniqueNodeTypes));
    onFilterInteraction(); // Notify parent about filter interaction
  };

  const handleClearAll = () => {
    onSelectedNodeTypesChange(new Set());
    onFilterInteraction(); // Notify parent about filter interaction
  };

  return (
    <Card className="h-full bg-background/80 backdrop-blur-sm border-none shadow-lg" onClick={e => e.stopPropagation()}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center">
          <Network className="h-5 w-5 mr-2" />
          <CardTitle className="text-xl">Node Types</CardTitle>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} title="Close Node Types Panel">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="h-[calc(100%-60px)] flex flex-col p-4 overflow-hidden">
        <div className="flex space-x-2 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            disabled={uniqueNodeTypes.length === 0 || selectedNodeTypes.size === uniqueNodeTypes.length}
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
        <ScrollArea className="flex-grow pr-4 hide-scrollbar">
          <div className="grid gap-2">
            {uniqueNodeTypes.map((type) => (
              <div key={type} className="flex items-center space-x-2">
                <Checkbox
                  id={`node-type-${type}`}
                  checked={selectedNodeTypes.has(type)}
                  onCheckedChange={(checked) => handleNodeTypeChange(type, checked as boolean)}
                />
                <Label htmlFor={`node-type-${type}`} className="text-sm cursor-pointer flex items-center space-x-2">
                  <span className={cn("h-4 w-4 rounded-full")} style={{ backgroundColor: colorScale(type) }}></span>
                  <span>{type}</span>
                </Label>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default NodeTypesPanel;