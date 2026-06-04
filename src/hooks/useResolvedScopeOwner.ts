import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { resolveGroupOwner, resolveWorkspaceOwner } from "@/lib/resolveScopedOwner";
import type { OwnerParams } from "@/lib/ownerScope";
import {
  ownerParamsForScopedName,
  ownerParamsValidatedForName,
} from "@/lib/ownerScope";

export interface ResolvedScopeOwnerState {
  owner: OwnerParams | undefined;
  needsOwner: boolean;
  ready: boolean;
  resolving: boolean;
}

/**
 * Owner params for API calls on the active workspace/group scope.
 * Uses local lists first, then lookup APIs when the owner is missing or ambiguous.
 */
export function useResolvedScopeOwner(): ResolvedScopeOwnerState {
  const {
    scopeMode,
    currentWorkspace,
    currentWorkspaceOwnerId,
    setCurrentWorkspace,
    workspaceList,
    activeGroup,
    activeGroupOwnerId,
    setActiveGroup,
    groups,
    scopeHydrated,
  } = useWorkspace();

  const syncOwner = useMemo(() => {
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
    activeGroup,
    activeGroupOwnerId,
    groups,
    currentWorkspace,
    currentWorkspaceOwnerId,
    workspaceList,
  ]);

  const [lookupOwner, setLookupOwner] = useState<OwnerParams | undefined>();
  const [lookupAmbiguous, setLookupAmbiguous] = useState(false);
  const [resolving, setResolving] = useState(false);

  const scopeKey = useMemo(() => {
    if (scopeMode === "group" && activeGroup) {
      return `group:${activeGroup}:${activeGroupOwnerId ?? ""}`;
    }
    if (scopeMode === "workspace" && currentWorkspace) {
      return `ws:${currentWorkspace}:${currentWorkspaceOwnerId ?? ""}`;
    }
    return "";
  }, [scopeMode, activeGroup, activeGroupOwnerId, currentWorkspace, currentWorkspaceOwnerId]);

  const scopeItems = scopeMode === "group" ? groups : workspaceList;
  const scopeName = scopeMode === "group" ? activeGroup : currentWorkspace;
  const syncOwnerValidated = useMemo(
    () =>
      syncOwner != null &&
      scopeName != null &&
      ownerParamsValidatedForName(scopeItems, scopeName, syncOwner),
    [syncOwner, scopeName, scopeItems]
  );

  useEffect(() => {
    if (!scopeKey) {
      setLookupOwner(undefined);
      setLookupAmbiguous(false);
      setResolving(false);
      return;
    }

    if (syncOwnerValidated) {
      setLookupOwner(syncOwner);
      setLookupAmbiguous(false);
      setResolving(false);
      return;
    }

    setLookupOwner(undefined);
    let cancelled = false;
    setResolving(true);

    void (async () => {
      try {
        if (scopeMode === "group" && activeGroup) {
          const result = await resolveGroupOwner(activeGroup, activeGroupOwnerId, {
            cache: groups,
          });
          if (cancelled) return;
          setLookupOwner(result.owner);
          setLookupAmbiguous(result.ambiguous);
        } else if (scopeMode === "workspace" && currentWorkspace) {
          const result = await resolveWorkspaceOwner(
            currentWorkspace,
            currentWorkspaceOwnerId,
            { cache: workspaceList }
          );
          if (cancelled) return;
          setLookupOwner(result.owner);
          setLookupAmbiguous(result.ambiguous);
        }
      } catch {
        if (!cancelled) {
          setLookupOwner(undefined);
          setLookupAmbiguous(false);
        }
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    scopeKey,
    scopeMode,
    activeGroup,
    activeGroupOwnerId,
    currentWorkspace,
    currentWorkspaceOwnerId,
    groups,
    workspaceList,
    syncOwner,
    syncOwnerValidated,
  ]);

  const owner = lookupOwner ?? (syncOwnerValidated ? syncOwner : undefined);

  useEffect(() => {
    if (!syncOwnerValidated || syncOwner?.ownerId == null) return;
    if (scopeMode === "workspace" && currentWorkspace) {
      if (currentWorkspaceOwnerId !== syncOwner.ownerId) {
        setCurrentWorkspace(currentWorkspace, syncOwner.ownerId);
      }
      return;
    }
    if (scopeMode === "group" && activeGroup) {
      if (activeGroupOwnerId !== syncOwner.ownerId) {
        setActiveGroup(activeGroup, syncOwner.ownerId);
      }
    }
  }, [
    scopeMode,
    currentWorkspace,
    currentWorkspaceOwnerId,
    activeGroup,
    activeGroupOwnerId,
    syncOwner,
    syncOwnerValidated,
    setCurrentWorkspace,
    setActiveGroup,
  ]);

  const needsOwner =
    !!scopeKey && (lookupAmbiguous || (!owner && scopeHydrated && !resolving));
  const ready = scopeHydrated && !resolving && (!needsOwner || owner != null);

  return { owner, needsOwner, ready, resolving };
}

/** @deprecated Prefer useResolvedScopeOwner — kept for gradual migration */
export function useScopeOwnerFromResolved(): OwnerParams | undefined {
  return useResolvedScopeOwner().owner;
}
