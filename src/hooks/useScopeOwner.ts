import { useMemo } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import type { OwnerParams } from "@/lib/ownerScope";
import {
  nameNeedsOwnerDisambiguation,
  ownerParamsForScopedName,
} from "@/lib/ownerScope";
import type { KgApiScope } from "@/database/workspaceStorage";
import { groupScope, workspaceScope } from "@/database/workspaceStorage";
import type { ViewScopeMode } from "@/lib/viewScope";

/** Owner query params for the active workspace or group scope. */
export function useScopeOwner(): OwnerParams | undefined {
  const {
    scopeMode,
    currentWorkspace,
    currentWorkspaceOwnerId,
    workspaceList,
    activeGroup,
    activeGroupOwnerId,
    groups,
  } = useWorkspace();

  return useMemo(() => {
    if (scopeMode === "group" && activeGroup) {
      return ownerParamsForScopedName(groups, activeGroup, activeGroupOwnerId);
    }
    if (scopeMode === "workspace" && currentWorkspace) {
      return ownerParamsForScopedName(
        workspaceList,
        currentWorkspace,
        currentWorkspaceOwnerId
      );
    }
    return undefined;
  }, [
    scopeMode,
    currentWorkspace,
    currentWorkspaceOwnerId,
    workspaceList,
    activeGroup,
    activeGroupOwnerId,
    groups,
  ]);
}

/** True when the active scope name requires owner_id before API calls. */
export function useScopeNeedsOwner(): boolean {
  const {
    scopeMode,
    currentWorkspace,
    workspaceList,
    activeGroup,
    groups,
  } = useWorkspace();

  return useMemo(() => {
    if (scopeMode === "group" && activeGroup) {
      return nameNeedsOwnerDisambiguation(groups, activeGroup);
    }
    if (scopeMode === "workspace" && currentWorkspace) {
      return nameNeedsOwnerDisambiguation(workspaceList, currentWorkspace);
    }
    return false;
  }, [scopeMode, currentWorkspace, workspaceList, activeGroup, groups]);
}

export function buildKgScope(
  mode: ViewScopeMode,
  workspaceName: string | null,
  groupName: string | null,
  owner?: OwnerParams
): KgApiScope | null {
  if (mode === "group" && groupName) {
    return groupScope(groupName, owner);
  }
  if (workspaceName) {
    return workspaceScope(workspaceName, owner);
  }
  return null;
}
