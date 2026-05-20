import { readMigratedLocalStorage } from "@/lib/migrateStorageKey";
import { FLAGGED_GROUP_NAME } from "@/database/workspaceStorage";

export type ViewScopeMode = "workspace" | "group";

const SCOPE_MODE_KEY = "nodepoint_view_scope_mode";
const ACTIVE_GROUP_KEY = "nodepoint_active_group";
const LEGACY_CHAT_SCOPE_KEY = "nodepoint_chat_scope";
const LEGACY_PRAJNA_CHAT_SCOPE_KEY = "prajna_chat_scope";

export function isSelectableGroup(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed !== FLAGGED_GROUP_NAME;
}

export function filterSelectableGroups<T extends { name: string; is_system?: boolean }>(
  groups: T[]
): T[] {
  return groups.filter((g) => isSelectableGroup(g.name) && !g.is_system);
}

export function getStoredViewScope(): { mode: ViewScopeMode; groupName: string | null } {
  try {
    const modeRaw = localStorage.getItem(SCOPE_MODE_KEY);
    const groupRaw = localStorage.getItem(ACTIVE_GROUP_KEY);

    if (modeRaw === "workspace") {
      return { mode: "workspace", groupName: null };
    }
    if (modeRaw === "group") {
      const groupName =
        groupRaw && isSelectableGroup(groupRaw) ? groupRaw : null;
      return { mode: "group", groupName };
    }

    const legacy = readMigratedLocalStorage(
      LEGACY_CHAT_SCOPE_KEY,
      LEGACY_PRAJNA_CHAT_SCOPE_KEY
    );
    if (legacy === "global" || legacy === "flagged") {
      return { mode: "group", groupName: null };
    }
    return { mode: "workspace", groupName: null };
  } catch {
    return { mode: "workspace", groupName: null };
  }
}

export function setStoredViewScope(
  mode: ViewScopeMode,
  groupName: string | null
): void {
  try {
    localStorage.setItem(SCOPE_MODE_KEY, mode);
    if (mode === "group" && groupName && isSelectableGroup(groupName)) {
      localStorage.setItem(ACTIVE_GROUP_KEY, groupName);
    } else if (mode === "workspace") {
      localStorage.removeItem(ACTIVE_GROUP_KEY);
    }
  } catch {
    /* ignore */
  }
}

/** @deprecated Use ViewScopeMode */
export type ChatScope = "workspace" | "global";

/** @deprecated Use getStoredViewScope */
export function getStoredChatScope(): ChatScope {
  const { mode } = getStoredViewScope();
  return mode === "group" ? "global" : "workspace";
}

/** @deprecated Use setStoredViewScope */
export function setStoredChatScope(scope: ChatScope): void {
  if (scope === "global") {
    const { groupName } = getStoredViewScope();
    setStoredViewScope("group", groupName);
  } else {
    setStoredViewScope("workspace", null);
  }
}
