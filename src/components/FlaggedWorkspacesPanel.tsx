"use client";

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FolderOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GraphNode } from "@/database/workspaceStorage";
import { getGraphNodeWorkspace } from "@/lib/graphWorkspace";

interface FlaggedWorkspacesPanelProps {
  nodes: GraphNode[];
  workspaceNames: string[];
  selectedWorkspaces: Set<string>;
  onSelectedWorkspacesChange: React.Dispatch<React.SetStateAction<Set<string>>>;
  onClose: () => void;
  onFilterInteraction: () => void;
}

const FlaggedWorkspacesPanel: React.FC<FlaggedWorkspacesPanelProps> = ({
  nodes,
  workspaceNames,
  selectedWorkspaces,
  onSelectedWorkspacesChange,
  onClose,
  onFilterInteraction,
}) => {
  const nodeCountByWorkspace = useMemo(() => {
    const counts = new Map<string, number>();
    for (const name of workspaceNames) counts.set(name, 0);
    for (const node of nodes) {
      const ws = getGraphNodeWorkspace(node);
      if (ws && counts.has(ws)) counts.set(ws, (counts.get(ws) ?? 0) + 1);
    }
    return counts;
  }, [nodes, workspaceNames]);

  const handleToggle = (name: string, checked: boolean) => {
    onSelectedWorkspacesChange((prev) => {
      const next = new Set(prev);
      if (checked) next.add(name);
      else next.delete(name);
      return next;
    });
    onFilterInteraction();
  };

  const handleSelectAll = () => {
    onSelectedWorkspacesChange(new Set(workspaceNames));
    onFilterInteraction();
  };

  const handleClearAll = () => {
    onSelectedWorkspacesChange(new Set());
    onFilterInteraction();
  };

  return (
    <Card className="h-full border-none bg-background/80 shadow-lg backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center">
          <FolderOpen className="mr-2 h-5 w-5" />
          <CardTitle className="text-xl">Workspaces</CardTitle>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} title="Close workspaces panel">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex h-[calc(100%-60px)] flex-col overflow-hidden p-4">
        <p className="mb-3 text-xs text-muted-foreground">
          Filter the merged graph to starred workspaces. Select which corpora to show.
        </p>
        <div className="mb-4 flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            disabled={
              workspaceNames.length === 0 ||
              selectedWorkspaces.size === workspaceNames.length
            }
            className="flex-1"
          >
            Select all
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            disabled={selectedWorkspaces.size === 0}
            className="flex-1"
          >
            Clear all
          </Button>
        </div>
        <ScrollArea className="flex-1 pr-2">
          <div className="space-y-2">
            {workspaceNames.length === 0 ? (
              <p className="text-sm text-muted-foreground">No workspaces in graph data.</p>
            ) : (
              workspaceNames.map((name) => (
                <div key={name} className="flex items-start space-x-2 rounded-md p-2 hover:bg-muted/50">
                  <Checkbox
                    id={`ws-filter-${name}`}
                    checked={selectedWorkspaces.has(name)}
                    onCheckedChange={(checked) => handleToggle(name, checked === true)}
                  />
                  <Label
                    htmlFor={`ws-filter-${name}`}
                    className="flex-1 cursor-pointer text-sm font-normal leading-snug"
                  >
                    <span className="break-all font-medium">{name}</span>
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({nodeCountByWorkspace.get(name) ?? 0} nodes)
                    </span>
                  </Label>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default FlaggedWorkspacesPanel;
