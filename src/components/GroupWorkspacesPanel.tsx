"use client";

import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GraphNode } from "@/database/workspaceStorage";
import { KB_MAX_GROUP_GRAPH_WORKSPACES } from "@/database/workspaceStorage";
import { getGraphNodeWorkspace } from "@/lib/graphWorkspace";
import { KbGraphSidePanel } from "@/components/knowledge-base/KbGraphSidePanel";
import { cn } from "@/lib/utils";

const BROWSE_CAP = 100;

interface GroupWorkspacesPanelProps {
  nodes: GraphNode[];
  workspaceNames: string[];
  selectedWorkspaces: Set<string>;
  onSelectedWorkspacesChange: React.Dispatch<React.SetStateAction<Set<string>>>;
  onClose: () => void;
  onFilterInteraction: () => void;
  maxSelection?: number;
  memberCount?: number;
}

const GroupWorkspacesPanel: React.FC<GroupWorkspacesPanelProps> = ({
  nodes,
  workspaceNames,
  selectedWorkspaces,
  onSelectedWorkspacesChange,
  onClose,
  onFilterInteraction,
  maxSelection = KB_MAX_GROUP_GRAPH_WORKSPACES,
  memberCount = workspaceNames.length,
}) => {
  const [query, setQuery] = useState("");

  const sortedNames = useMemo(
    () => [...workspaceNames].sort((a, b) => a.localeCompare(b)),
    [workspaceNames]
  );

  const nodeCountByWorkspace = useMemo(() => {
    const counts = new Map<string, number>();
    for (const name of workspaceNames) counts.set(name, 0);
    for (const node of nodes) {
      const ws = getGraphNodeWorkspace(node);
      if (ws && counts.has(ws)) counts.set(ws, (counts.get(ws) ?? 0) + 1);
    }
    return counts;
  }, [nodes, workspaceNames]);

  const { visible, isBrowseCapped } = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = sortedNames;
    if (q) {
      list = list.filter((name) => name.toLowerCase().includes(q));
      return { visible: list.slice(0, 200), isBrowseCapped: list.length > 200 };
    }
    const inGraph = sortedNames.filter((n) => (nodeCountByWorkspace.get(n) ?? 0) > 0);
    const rest = sortedNames.filter((n) => (nodeCountByWorkspace.get(n) ?? 0) === 0);
    const merged = [...inGraph, ...rest];
    if (merged.length <= BROWSE_CAP) {
      return { visible: merged, isBrowseCapped: false };
    }
    return { visible: merged.slice(0, BROWSE_CAP), isBrowseCapped: true };
  }, [sortedNames, query, nodeCountByWorkspace]);

  const atCap = selectedWorkspaces.size >= maxSelection;

  const handleToggle = (name: string, checked: boolean) => {
    onSelectedWorkspacesChange((prev) => {
      const next = new Set(prev);
      if (checked) {
        if (next.size >= maxSelection) return prev;
        next.add(name);
      } else {
        next.delete(name);
      }
      return next;
    });
    onFilterInteraction();
  };

  const selectTopByNodes = () => {
    const ranked = [...sortedNames].sort(
      (a, b) => (nodeCountByWorkspace.get(b) ?? 0) - (nodeCountByWorkspace.get(a) ?? 0)
    );
    onSelectedWorkspacesChange(new Set(ranked.slice(0, maxSelection)));
    onFilterInteraction();
  };

  const selectFirstAlphabetical = () => {
    onSelectedWorkspacesChange(new Set(sortedNames.slice(0, maxSelection)));
    onFilterInteraction();
  };

  const toolbar = (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 flex-1 text-xs"
          onClick={selectFirstAlphabetical}
          disabled={workspaceNames.length === 0}
        >
          First {Math.min(maxSelection, workspaceNames.length)}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 flex-1 text-xs"
          onClick={selectTopByNodes}
          disabled={workspaceNames.length === 0 || nodes.length === 0}
        >
          Top by nodes
        </Button>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 flex-1 text-xs"
          onClick={() => {
            onSelectedWorkspacesChange(new Set());
            onFilterInteraction();
          }}
          disabled={selectedWorkspaces.size === 0}
        >
          Clear
        </Button>
      </div>
    </div>
  );

  return (
    <KbGraphSidePanel
      title="Workspaces in group"
      icon={<FolderOpen className="h-4 w-4" />}
      onClose={onClose}
      toolbar={toolbar}
    >
      <p className="mb-2 text-xs text-muted-foreground">
        {memberCount > maxSelection
          ? `Select up to ${maxSelection} of ${memberCount} workspaces, then Apply in Graph load.`
          : "Choose workspaces to include in the merged graph, then Apply."}
      </p>
      <p className="mb-2 text-xs font-medium text-foreground">
        {selectedWorkspaces.size} / {maxSelection} selected
      </p>

      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${workspaceNames.length} workspaces…`}
          className="h-8 pl-8 text-sm"
        />
      </div>

      {isBrowseCapped && !query.trim() ? (
        <p className="mb-2 text-xs text-muted-foreground">
          Showing first {visible.length} of {workspaceNames.length}. Search to find others.
        </p>
      ) : null}

      {workspaceNames.length === 0 ? (
        <p className="text-sm text-muted-foreground">No workspaces in this group.</p>
      ) : (
        <ScrollArea className="h-[min(40vh,320px)] rounded-md border">
          <ul className="space-y-0.5 p-2">
            {visible.map((name) => {
              const checked = selectedWorkspaces.has(name);
              const disableCheck = !checked && atCap;
              return (
                <li
                  key={name}
                  className={cn(
                    "flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50",
                    disableCheck && "opacity-60"
                  )}
                >
                  <Checkbox
                    id={`ws-filter-${name}`}
                    checked={checked}
                    disabled={disableCheck}
                    onCheckedChange={(v) => handleToggle(name, v === true)}
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor={`ws-filter-${name}`}
                    className={cn(
                      "min-w-0 flex-1 text-sm font-normal leading-snug",
                      disableCheck ? "cursor-not-allowed" : "cursor-pointer"
                    )}
                  >
                    <span className="break-all font-medium">{name}</span>
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({nodeCountByWorkspace.get(name) ?? 0} in graph)
                    </span>
                  </Label>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      )}
    </KbGraphSidePanel>
  );
};

export default GroupWorkspacesPanel;
