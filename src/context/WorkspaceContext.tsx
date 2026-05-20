"use client";

import React, {
  createContext,
  useState,
  useContext,
  useCallback,
  useEffect,
} from "react";
import {
  filterSelectableGroups,
  getStoredViewScope,
  isSelectableGroup,
  setStoredViewScope,
  type ViewScopeMode,
} from "@/lib/viewScope";
import {
  listWorkspaceGroups,
  type WorkspaceGroupSummary,
} from "@/database/workspaceStorage";

interface WorkspaceContextType {
  currentWorkspace: string | null;
  setCurrentWorkspace: (name: string | null) => void;
  scopeMode: ViewScopeMode;
  activeGroup: string | null;
  setScopeMode: (mode: ViewScopeMode) => void;
  setActiveGroup: (groupName: string | null) => void;
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
    null
  );
  const initialScope = getStoredViewScope();
  const [scopeMode, setScopeModeState] = useState<ViewScopeMode>(
    initialScope.mode
  );
  const [activeGroup, setActiveGroupState] = useState<string | null>(
    initialScope.groupName
  );
  const [groups, setGroups] = useState<WorkspaceGroupSummary[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);

  const setCurrentWorkspace = useCallback((name: string | null) => {
    setCurrentWorkspaceState(name);
  }, []);

  const refreshGroups = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const all = await listWorkspaceGroups();
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
        setStoredViewScope("group", activeGroup);
      }
    },
    [activeGroup]
  );

  const setActiveGroup = useCallback((groupName: string | null) => {
    const next =
      groupName && isSelectableGroup(groupName) ? groupName : null;
    setActiveGroupState(next);
    setScopeModeState("group");
    setStoredViewScope("group", next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const selectable = await refreshGroups();
      if (cancelled) return;

      const stored = getStoredViewScope();
      if (stored.mode === "group") {
        if (
          stored.groupName &&
          selectable.some((g) => g.name === stored.groupName)
        ) {
          setActiveGroupState(stored.groupName);
          setScopeModeState("group");
          return;
        }
        if (selectable.length > 0) {
          const first = selectable[0].name;
          setActiveGroupState(first);
          setScopeModeState("group");
          setStoredViewScope("group", first);
          return;
        }
        setScopeModeState("workspace");
        setActiveGroupState(null);
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
        setCurrentWorkspace,
        scopeMode,
        activeGroup,
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
