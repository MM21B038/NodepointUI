import { readMigratedLocalStorage } from "@/lib/migrateStorageKey";
import { FLAGGED_GROUP_NAME } from "@/database/workspaceStorage";

export type ViewScopeMode = "workspace" | "group";

const SCOPE_MODE_KEY = "nodepoint_view_scope_mode";
const ACTIVE_GROUP_KEY = "nodepoint_active_group";
const ACTIVE_GROUP_OWNER_ID_KEY = "nodepoint_active_group_owner_id";
const CURRENT_WORKSPACE_OWNER_ID_KEY = "nodepoint_current_workspace_owner_id";
const LEGACY_CHAT_SCOPE_KEY = "nodepoint_chat_scope";
const LEGACY_PRAJNA_CHAT_SCOPE_KEY = "prajna_chat_scope";

export function isSelectableGroup(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed !== FLAGGED_GROUP_NAME;
}

export function filterSelectableGroups<
  T extends { name: string; is_system?: boolean },
>(groups: T[]): T[] {
  return groups.filter((g) => isSelectableGroup(g.name) && !g.is_system);
}

export function getStoredViewScope(): {
  mode: ViewScopeMode;
  groupName: string | null;
  groupOwnerId: number | null;
} {
  try {
    const modeRaw = localStorage.getItem(SCOPE_MODE_KEY);
    const groupRaw = localStorage.getItem(ACTIVE_GROUP_KEY);
    const groupOwnerRaw = localStorage.getItem(ACTIVE_GROUP_OWNER_ID_KEY);

    if (modeRaw === "workspace") {
      return { mode: "workspace", groupName: null, groupOwnerId: null };
    }
    if (modeRaw === "group") {
      const groupName =
        groupRaw && isSelectableGroup(groupRaw) ? groupRaw : null;
      const groupOwnerId =
        groupOwnerRaw != null && groupOwnerRaw !== ""
          ? Number(groupOwnerRaw)
          : null;
      return {
        mode: "group",
        groupName,
        groupOwnerId: Number.isFinite(groupOwnerId) ? groupOwnerId : null,
      };
    }

    const legacy = readMigratedLocalStorage(
      LEGACY_CHAT_SCOPE_KEY,
      LEGACY_PRAJNA_CHAT_SCOPE_KEY
    );
    if (legacy === "global" || legacy === "flagged") {
      return { mode: "group", groupName: null, groupOwnerId: null };
    }
    return { mode: "workspace", groupName: null, groupOwnerId: null };
  } catch {
    return { mode: "workspace", groupName: null, groupOwnerId: null };
  }
}

export function getStoredWorkspaceOwnerId(): number | null {
  try {
    const raw = localStorage.getItem(CURRENT_WORKSPACE_OWNER_ID_KEY);
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function setStoredWorkspaceOwnerId(ownerId: number | null): void {
  try {
    if (ownerId != null) {
      localStorage.setItem(CURRENT_WORKSPACE_OWNER_ID_KEY, String(ownerId));
    } else {
      localStorage.removeItem(CURRENT_WORKSPACE_OWNER_ID_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function setStoredViewScope(
  mode: ViewScopeMode,
  groupName: string | null,
  groupOwnerId?: number | null
): void {
  try {
    localStorage.setItem(SCOPE_MODE_KEY, mode);
    if (mode === "group" && groupName && isSelectableGroup(groupName)) {
      localStorage.setItem(ACTIVE_GROUP_KEY, groupName);
      if (groupOwnerId != null) {
        localStorage.setItem(ACTIVE_GROUP_OWNER_ID_KEY, String(groupOwnerId));
      } else {
        localStorage.removeItem(ACTIVE_GROUP_OWNER_ID_KEY);
      }
    } else if (mode === "workspace") {
      localStorage.removeItem(ACTIVE_GROUP_KEY);
      localStorage.removeItem(ACTIVE_GROUP_OWNER_ID_KEY);
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
    const { groupName, groupOwnerId } = getStoredViewScope();
    setStoredViewScope("group", groupName, groupOwnerId);
  } else {
    setStoredViewScope("workspace", null);
  }
}
