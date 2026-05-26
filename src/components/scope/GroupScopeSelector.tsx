"use client";

import { FolderOpen } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GroupCombobox from "@/components/scope/GroupCombobox";
import { useWorkspace } from "@/context/WorkspaceContext";
import type { ViewScopeMode } from "@/lib/viewScope";

interface GroupScopeSelectorProps {
  disabled?: boolean;
}

export default function GroupScopeSelector({
  disabled = false,
}: GroupScopeSelectorProps) {
  const {
    scopeMode,
    activeGroup,
    setScopeMode,
    setActiveGroup,
    groups,
    groupsLoading,
  } = useWorkspace();

  const handleModeChange = (value: string) => {
    const mode = value as ViewScopeMode;
    setScopeMode(mode);
    if (mode === "group" && !activeGroup && groups.length > 0) {
      setActiveGroup(groups[0].name);
    }
  };

  const handleGroupChange = (name: string) => {
    setActiveGroup(name);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs value={scopeMode} onValueChange={handleModeChange}>
        <TabsList className="h-8 border border-border/60 bg-muted/40 p-0.5">
          <TabsTrigger
            value="workspace"
            disabled={disabled}
            className="text-xs px-3"
          >
            Workspace
          </TabsTrigger>
          <TabsTrigger value="group" disabled={disabled} className="text-xs px-3">
            Group
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {scopeMode === "group" && (
        groupsLoading ? (
          <span className="text-xs text-muted-foreground">Loading groups…</span>
        ) : groups.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            Create a group on Workspaces
          </span>
        ) : (
          <GroupCombobox
            groups={groups}
            value={activeGroup}
            onSelect={handleGroupChange}
            disabled={disabled}
          />
        )
      )}

      {scopeMode === "workspace" && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <FolderOpen className="h-3 w-3" />
          Current workspace
        </span>
      )}
    </div>
  );
}
