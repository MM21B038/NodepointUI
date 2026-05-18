"use client";

import React, { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GraphNode } from "@/database/workspaceStorage";
import { getGraphNodeWorkspace } from "@/lib/graphWorkspace";
import { KbGraphSidePanel } from "@/components/knowledge-base/KbGraphSidePanel";

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

  const toolbar = (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        className="h-8 flex-1 text-xs"
        onClick={() => {
          onSelectedWorkspacesChange(new Set(workspaceNames));
          onFilterInteraction();
        }}
        disabled={
          workspaceNames.length === 0 ||
          selectedWorkspaces.size === workspaceNames.length
        }
      >
        Select all
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-8 flex-1 text-xs"
        onClick={() => {
          onSelectedWorkspacesChange(new Set());
          onFilterInteraction();
        }}
        disabled={selectedWorkspaces.size === 0}
      >
        Clear all
      </Button>
    </div>
  );

  return (
    <KbGraphSidePanel
      title="Workspaces"
      icon={<FolderOpen className="h-4 w-4" />}
      onClose={onClose}
      toolbar={toolbar}
    >
      <p className="mb-3 text-xs text-muted-foreground">
        Filter the merged graph to starred workspaces. Select which corpora to show.
      </p>
      {workspaceNames.length === 0 ? (
        <p className="text-sm text-muted-foreground">No workspaces in graph data.</p>
      ) : (
        <ul className="space-y-1">
          {workspaceNames.map((name) => (
            <li
              key={name}
              className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
            >
              <Checkbox
                id={`ws-filter-${name}`}
                checked={selectedWorkspaces.has(name)}
                onCheckedChange={(checked) => handleToggle(name, checked === true)}
                className="mt-0.5"
              />
              <Label
                htmlFor={`ws-filter-${name}`}
                className="min-w-0 flex-1 cursor-pointer text-sm font-normal leading-snug"
              >
                <span className="break-all font-medium">{name}</span>
                <span className="ml-1 text-xs text-muted-foreground">
                  ({nodeCountByWorkspace.get(name) ?? 0} nodes)
                </span>
              </Label>
            </li>
          ))}
        </ul>
      )}
    </KbGraphSidePanel>
  );
};

export default FlaggedWorkspacesPanel;
