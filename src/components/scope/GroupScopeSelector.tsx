"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GroupCombobox from "@/components/scope/GroupCombobox";
import { useWorkspace } from "@/context/WorkspaceContext";
import type { ViewScopeMode } from "@/lib/viewScope";
import {
  duplicateNamesInList,
  formatScopedResourceLabel,
  listHasMultipleOwners,
} from "@/lib/ownerScope";

interface GroupScopeSelectorProps {
  disabled?: boolean;
}

export default function GroupScopeSelector({
  disabled = false,
}: GroupScopeSelectorProps) {
  const {
    scopeMode,
    currentWorkspace,
    currentWorkspaceOwnerId,
    workspaceList,
    activeGroup,
    activeGroupOwnerId,
    setScopeMode,
    setActiveGroup,
    groups,
    groupsLoading,
  } = useWorkspace();

  const handleModeChange = (value: string) => {
    const mode = value as ViewScopeMode;
    setScopeMode(mode);
    if (mode === "group" && !activeGroup && groups.length > 0) {
      const g = groups[0];
      setActiveGroup(g.name, g.owner_id ?? null);
    }
  };

  const handleGroupChange = (group: (typeof groups)[0]) => {
    setActiveGroup(group.name, group.owner_id ?? null);
  };

  const duplicateWorkspaceNames = duplicateNamesInList(workspaceList);
  const duplicateGroupNames = duplicateNamesInList(groups);
  const multiOwnerGroups = listHasMultipleOwners(groups);

  const workspaceLabel = currentWorkspace
    ? formatScopedResourceLabel(
        currentWorkspace,
        workspaceList.find(
          (w) =>
            w.name === currentWorkspace &&
            (currentWorkspaceOwnerId == null ||
              w.owner_id === currentWorkspaceOwnerId)
        )?.owner_username,
        { duplicateNames: duplicateWorkspaceNames }
      )
    : null;

  const groupLabel = activeGroup
    ? formatScopedResourceLabel(
        activeGroup,
        groups.find(
          (g) =>
            g.name === activeGroup &&
            (activeGroupOwnerId == null || g.owner_id === activeGroupOwnerId)
        )?.owner_username,
        { duplicateNames: duplicateGroupNames, multiOwnerList: multiOwnerGroups }
      )
    : null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Tabs value={scopeMode} onValueChange={handleModeChange}>
        <TabsList className="h-7 border border-border/60 bg-muted/40 p-0.5">
          <TabsTrigger
            value="workspace"
            disabled={disabled}
            className="h-6 px-2.5 text-[11px]"
          >
            Workspace
          </TabsTrigger>
          <TabsTrigger
            value="group"
            disabled={disabled}
            className="h-6 px-2.5 text-[11px]"
          >
            Group
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {scopeMode === "group" &&
        (groupsLoading ? (
          <span className="text-[11px] text-muted-foreground">Loading…</span>
        ) : groups.length === 0 ? (
          <span className="text-[11px] text-muted-foreground">No groups</span>
        ) : (
          <GroupCombobox
            groups={groups}
            value={activeGroup}
            valueOwnerId={activeGroupOwnerId}
            onSelect={handleGroupChange}
            disabled={disabled}
            className="h-7 min-w-[11rem] max-w-[16rem] text-[11px]"
          />
        ))}

      {scopeMode === "group" && groupLabel ? (
        <span
          className="max-w-[14rem] truncate text-[11px] text-muted-foreground"
          title={groupLabel}
        >
          {groupLabel}
        </span>
      ) : null}

      {scopeMode === "workspace" && workspaceLabel ? (
        <span
          className="max-w-[10rem] truncate text-[11px] text-muted-foreground"
          title={workspaceLabel}
        >
          {workspaceLabel}
        </span>
      ) : null}
    </div>
  );
}
