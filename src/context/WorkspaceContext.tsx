"use client";

import React, {
  createContext,
  useState,
  useContext,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  filterSelectableGroups,
  getStoredViewScope,
  getStoredWorkspaceOwnerId,
  isSelectableGroup,
  setStoredViewScope,
  setStoredWorkspaceOwnerId,
  type ViewScopeMode,
} from "@/lib/viewScope";
import {
  getStoredChatWorkspace,
  setStoredChatWorkspace,
} from "@/database/chatStorage";
import {
  getWorkspaces,
  listAllWorkspaceGroups,
  type WorkspaceEntry,
  type WorkspaceGroupSummary,
} from "@/database/workspaceStorage";
import {
  hydrateGroupFromList,
  hydrateWorkspaceFromList,
} from "@/lib/ownerScope";
import { resolveGroupOwner, resolveWorkspaceOwner } from "@/lib/resolveScopedOwner";

interface WorkspaceContextType {
  currentWorkspace: string | null;
  currentWorkspaceOwnerId: number | null;
  setCurrentWorkspace: (
    name: string | null,
    ownerId?: number | null
  ) => void;
  workspaceList: WorkspaceEntry[];
  scopeHydrated: boolean;
  refreshWorkspaceList: () => Promise<WorkspaceEntry[]>;
  scopeMode: ViewScopeMode;
  activeGroup: string | null;
  activeGroupOwnerId: number | null;
  setScopeMode: (mode: ViewScopeMode) => void;
  setActiveGroup: (groupName: string | null, ownerId?: number | null) => void;
  groups: WorkspaceGroupSummary[];
  groupsLoading: boolean;
  refreshGroups: () => Promise<WorkspaceGroupSummary[]>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined
);

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
};

interface WorkspaceProviderProps {
  children: React.ReactNode;
}

export const WorkspaceProvider: React.FC<WorkspaceProviderProps> = ({
  children,
}) => {
  const [currentWorkspace, setCurrentWorkspaceState] = useState<string | null>(
    () => getStoredChatWorkspace()
  );
  const [currentWorkspaceOwnerId, setCurrentWorkspaceOwnerIdState] = useState<
    number | null
  >(getStoredWorkspaceOwnerId);
  const [workspaceList, setWorkspaceList] = useState<WorkspaceEntry[]>([]);
  const [scopeHydrated, setScopeHydrated] = useState(false);
  const initialScope = getStoredViewScope();
  const [scopeMode, setScopeModeState] = useState<ViewScopeMode>(
    initialScope.mode
  );
  const [activeGroup, setActiveGroupState] = useState<string | null>(
    initialScope.groupName
  );
  const [activeGroupOwnerId, setActiveGroupOwnerIdState] = useState<
    number | null
  >(initialScope.groupOwnerId);
  const [groups, setGroups] = useState<WorkspaceGroupSummary[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);

  const workspaceScopeRef = useRef({
    name: currentWorkspace,
    ownerId: currentWorkspaceOwnerId,
  });
  workspaceScopeRef.current = {
    name: currentWorkspace,
    ownerId: currentWorkspaceOwnerId,
  };

  const setCurrentWorkspace = useCallback(
    (name: string | null, ownerId?: number | null) => {
      setCurrentWorkspaceState(name);
      const id = ownerId ?? null;
      setCurrentWorkspaceOwnerIdState(id);
      setStoredWorkspaceOwnerId(id);
      try {
        if (name?.trim()) {
          setStoredChatWorkspace(name.trim());
        }
      } catch {
        /* ignore */
      }
    },
    []
  );

  const refreshWorkspaceList = useCallback(async () => {
    const list = await getWorkspaces();
    list.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    setWorkspaceList(list);

    const { name, ownerId } = workspaceScopeRef.current;
    let hydrated = hydrateWorkspaceFromList(list, name, ownerId);
    if (hydrated.name && hydrated.ownerId == null) {
      try {
        const resolved = await resolveWorkspaceOwner(hydrated.name, ownerId, {
          cache: list,
        });
        if (resolved.owner?.ownerId != null) {
          hydrated = { name: hydrated.name, ownerId: resolved.owner.ownerId };
        } else if (resolved.matches.length === 1) {
          const only = resolved.matches[0] as WorkspaceEntry;
          hydrated = { name: only.name, ownerId: only.owner_id ?? null };
        }
      } catch {
        /* keep list-based hydrate */
      }
    }
    setCurrentWorkspaceState(hydrated.name);
    setCurrentWorkspaceOwnerIdState(hydrated.ownerId);
    setStoredWorkspaceOwnerId(hydrated.ownerId);
    if (hydrated.name?.trim()) {
      setStoredChatWorkspace(hydrated.name.trim());
    }

    setScopeHydrated(true);
    return list;
  }, []);

  useEffect(() => {
    void refreshWorkspaceList();
  }, [refreshWorkspaceList]);

  const refreshGroups = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const all = await listAllWorkspaceGroups();
      const selectable = filterSelectableGroups(all);
      setGroups(selectable);
      return selectable;
    } catch (error) {
      console.error("Failed to load workspace groups:", error);
      setGroups([]);
      return [];
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  const setScopeMode = useCallback(
    (mode: ViewScopeMode) => {
      setScopeModeState(mode);
      if (mode === "workspace") {
        setStoredViewScope("workspace", null);
      } else {
        setStoredViewScope("group", activeGroup, activeGroupOwnerId);
      }
    },
    [activeGroup, activeGroupOwnerId]
  );

  const setActiveGroup = useCallback(
    (groupName: string | null, ownerId?: number | null) => {
      const next =
        groupName && isSelectableGroup(groupName) ? groupName : null;
      const id = ownerId ?? null;
      setActiveGroupState(next);
      setActiveGroupOwnerIdState(id);
      setScopeModeState("group");
      setStoredViewScope("group", next, id);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const selectable = await refreshGroups();
      if (cancelled) return;

      const stored = getStoredViewScope();
      if (stored.mode === "group") {
        if (stored.groupName) {
          let hydrated = hydrateGroupFromList(
            selectable,
            stored.groupName,
            stored.groupOwnerId
          );
          if (hydrated.name && hydrated.ownerId == null) {
            try {
              const resolved = await resolveGroupOwner(
                hydrated.name,
                stored.groupOwnerId,
                { cache: selectable }
              );
              if (resolved.owner?.ownerId != null) {
                hydrated = {
                  name: hydrated.name,
                  ownerId: resolved.owner.ownerId,
                };
              } else if (resolved.matches.length === 1) {
                const only = resolved.matches[0] as WorkspaceGroupSummary;
                hydrated = {
                  name: only.name,
                  ownerId: only.owner_id ?? null,
                };
              }
            } catch {
              /* keep list-based hydrate */
            }
          }
          if (hydrated.name) {
            setActiveGroupState(hydrated.name);
            setActiveGroupOwnerIdState(hydrated.ownerId);
            setScopeModeState("group");
            setStoredViewScope("group", hydrated.name, hydrated.ownerId);
            return;
          }
        }
        if (selectable.length > 0) {
          const first = selectable[0];
          setActiveGroupState(first.name);
          setActiveGroupOwnerIdState(first.owner_id ?? null);
          setScopeModeState("group");
          setStoredViewScope("group", first.name, first.owner_id ?? null);
          return;
        }
        setScopeModeState("workspace");
        setActiveGroupState(null);
        setActiveGroupOwnerIdState(null);
        setStoredViewScope("workspace", null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshGroups]);

  return (
    <WorkspaceContext.Provider
      value={{
        currentWorkspace,
        currentWorkspaceOwnerId,
        setCurrentWorkspace,
        workspaceList,
        scopeHydrated,
        refreshWorkspaceList,
        scopeMode,
        activeGroup,
        activeGroupOwnerId,
        setScopeMode,
        setActiveGroup,
        groups,
        groupsLoading,
        refreshGroups,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};
