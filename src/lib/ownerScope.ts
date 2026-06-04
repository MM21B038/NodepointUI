/** Per-owner naming: workspaces/groups are unique per owner, not globally. */

export interface OwnerParams {
  ownerId?: number;
  ownerUsername?: string;
}

export interface OwnedResourceFields {
  id?: number;
  name: string;
  owner_id?: number;
  owner_username?: string | null;
}

export function normalizeOwnerFields(raw: Record<string, unknown>): {
  id?: number;
  owner_id?: number;
  owner_username?: string;
} {
  const id = raw.id != null ? Number(raw.id) : undefined;
  const owner_id =
    raw.owner_id != null
      ? Number(raw.owner_id)
      : raw.ownerId != null
        ? Number(raw.ownerId)
        : undefined;
  const owner_username =
    raw.owner_username != null
      ? String(raw.owner_username)
      : raw.ownerUsername != null
        ? String(raw.ownerUsername)
        : undefined;
  return { id, owner_id, owner_username };
}

export function appendOwnerQuery(
  query: Record<string, string>,
  owner?: OwnerParams
): Record<string, string> {
  const out = { ...query };
  if (owner?.ownerId != null) {
    out.owner_id = String(owner.ownerId);
  } else if (owner?.ownerUsername?.trim()) {
    out.owner_username = owner.ownerUsername.trim();
  }
  return out;
}

/** Append `owner_id` / `owner_username` to URL query parts (REST or WebSocket). */
export function appendOwnerQueryParts(
  parts: string[],
  owner?: OwnerParams
): string[] {
  const q = appendOwnerQuery({}, owner);
  for (const [key, value] of Object.entries(q)) {
    parts.push(`${key}=${encodeURIComponent(value)}`);
  }
  return parts;
}

export function ownerParamsFrom(
  resource?: OwnedResourceFields | null
): OwnerParams | undefined {
  if (!resource) return undefined;
  if (resource.owner_id != null) {
    return {
      ownerId: resource.owner_id,
      ownerUsername: resource.owner_username ?? undefined,
    };
  }
  if (resource.owner_username?.trim()) {
    return { ownerUsername: resource.owner_username.trim() };
  }
  return undefined;
}

/** Rows sharing the same display name (different owners). */
export function matchesByName<T extends { name: string }>(
  items: T[],
  name: string
): T[] {
  return items.filter((item) => item.name === name);
}

export function nameNeedsOwnerDisambiguation(
  items: { name: string }[],
  name: string
): boolean {
  return matchesByName(items, name).length > 1;
}

/** Resolve owner query params for a scoped name (workspace or group). */
export function ownerParamsForScopedName(
  items: OwnedResourceFields[],
  name: string,
  ownerId?: number | null
): OwnerParams | undefined {
  const matches = matchesByName(items, name);
  if (matches.length === 0) return undefined;
  if (ownerId != null) {
    const match = matches.find((m) => m.owner_id === ownerId);
    if (match) return ownerParamsFrom(match);
    if (matches.length === 1) return ownerParamsFrom(matches[0]);
    return undefined;
  }
  if (matches.length === 1) return ownerParamsFrom(matches[0]);
  return undefined;
}

/** True when owner params match a row with the given scoped name. */
export function ownerParamsValidatedForName(
  items: OwnedResourceFields[],
  name: string,
  owner?: OwnerParams
): boolean {
  if (!owner) return false;
  const matches = matchesByName(items, name);
  if (matches.length === 0) return false;
  if (owner.ownerId != null) {
    return matches.some((m) => m.owner_id === owner.ownerId);
  }
  const username = owner.ownerUsername?.trim();
  if (username) {
    return matches.some((m) => m.owner_username?.trim() === username);
  }
  return false;
}

export function hydrateWorkspaceFromList<
  T extends OwnedResourceFields & { name: string },
>(
  list: T[],
  currentName: string | null,
  currentOwnerId: number | null
): { name: string | null; ownerId: number | null } {
  if (list.length === 0) return { name: null, ownerId: null };
  if (!currentName?.trim()) {
    const first = list[0];
    return { name: first.name, ownerId: first.owner_id ?? null };
  }
  const matches = matchesByName(list, currentName);
  if (matches.length === 0) {
    const first = list[0];
    return { name: first.name, ownerId: first.owner_id ?? null };
  }
  if (matches.length === 1) {
    const only = matches[0];
    return { name: only.name, ownerId: only.owner_id ?? null };
  }
  if (currentOwnerId != null) {
    const picked = matches.find((m) => m.owner_id === currentOwnerId);
    if (picked) return { name: picked.name, ownerId: picked.owner_id ?? null };
  }
  return { name: currentName, ownerId: null };
}

export function hydrateGroupFromList<
  T extends OwnedResourceFields & { name: string },
>(
  list: T[],
  currentName: string | null,
  currentOwnerId: number | null
): { name: string | null; ownerId: number | null } {
  return hydrateWorkspaceFromList(list, currentName, currentOwnerId);
}

/** Stable key for lists/maps when names repeat across owners. */
export function workspaceResourceKey(
  name: string,
  ownerId?: number
): string {
  return `${ownerId ?? 0}:${name}`;
}

export function groupResourceKey(name: string, ownerId?: number): string {
  return `${ownerId ?? 0}:${name}`;
}

/** Parse `ownerId:name` keys from scoped pickers and filters. */
export function parseResourceKey(key: string): {
  name: string;
  ownerId?: number;
} {
  const sep = key.indexOf(":");
  if (sep <= 0) return { name: key };
  const ownerPart = key.slice(0, sep);
  const name = key.slice(sep + 1);
  const n = Number(ownerPart);
  return {
    name,
    ownerId: Number.isFinite(n) && n > 0 ? n : undefined,
  };
}

export interface GroupWorkspaceMutationOptions {
  /** Disambiguates the group in the URL path. */
  groupOwner?: OwnerParams;
  /** Disambiguates the workspace (body on POST; query on DELETE). */
  workspaceOwner?: OwnerParams;
}

/** Disambiguates the group on file/entity/relation membership URLs. */
export interface GroupMemberMutationOptions {
  groupOwner?: OwnerParams;
}

/** POST `/group/<name>/workspaces/` body with optional workspace owner. */
export function buildGroupWorkspacePostBody(
  workspaceName: string,
  workspaceOwner?: OwnerParams
): Record<string, string | number> {
  const body: Record<string, string | number> = {
    workspace_name: workspaceName,
  };
  if (workspaceOwner?.ownerId != null) {
    body.owner_id = workspaceOwner.ownerId;
  } else if (workspaceOwner?.ownerUsername?.trim()) {
    body.owner_username = workspaceOwner.ownerUsername.trim();
  }
  return body;
}

/** DELETE query when both group and workspace names may be ambiguous. */
export function appendGroupWorkspaceDeleteQuery(
  query: Record<string, string>,
  options?: GroupWorkspaceMutationOptions
): Record<string, string> {
  const out = { ...query };
  const groupQ = appendOwnerQuery({}, options?.groupOwner);
  const wsQ = appendOwnerQuery({}, options?.workspaceOwner);

  if (groupQ.owner_id) out.owner_id = groupQ.owner_id;
  else if (groupQ.owner_username) out.owner_username = groupQ.owner_username;

  if (wsQ.owner_id) {
    if (out.owner_id || out.owner_username) {
      out.workspace_owner_id = wsQ.owner_id;
    } else {
      out.owner_id = wsQ.owner_id;
    }
  } else if (wsQ.owner_username) {
    if (out.owner_id || out.owner_username) {
      out.workspace_owner_username = wsQ.owner_username;
    } else {
      out.owner_username = wsQ.owner_username;
    }
  }

  return out;
}

/** Names that appear more than once in a list (different owners). */
export function duplicateNamesInList<T extends { name: string }>(
  items: T[]
): Set<string> {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.name, (counts.get(item.name) ?? 0) + 1);
  }
  return new Set(
    [...counts.entries()].filter(([, n]) => n > 1).map(([name]) => name)
  );
}

export function shouldShowOwnerLabel(
  name: string,
  duplicateNames: Set<string>,
  ownerUsername?: string | null
): boolean {
  return duplicateNames.has(name) && Boolean(ownerUsername?.trim());
}

/** True when the list contains resources owned by more than one user (admin directory views). */
export function listHasMultipleOwners<T extends { owner_id?: number }>(
  items: T[]
): boolean {
  const owners = new Set(
    items.map((item) => item.owner_id).filter((id): id is number => id != null)
  );
  return owners.size > 1;
}

/** Whether to show owner beside a scoped name in pickers and labels. */
export function shouldShowScopedOwner(
  name: string,
  ownerUsername: string | null | undefined,
  duplicateNames: Set<string>,
  multiOwnerList = false
): boolean {
  if (!ownerUsername?.trim()) return false;
  return duplicateNames.has(name) || multiOwnerList;
}

/** When names collide or the list spans owners, show owner on picker rows. */
export function shouldShowOwnerInScopedPicker(
  duplicateNames: Set<string>,
  ownerUsername?: string | null,
  multiOwnerList = false
): boolean {
  if (!ownerUsername?.trim()) return false;
  return multiOwnerList || duplicateNames.size > 0;
}

/**
 * Display label for admin/superadmin lists: `PRAJNA · alice` when names repeat.
 */
export function formatScopedResourceLabel(
  name: string,
  ownerUsername?: string | null,
  options?: {
    forceOwner?: boolean;
    duplicateNames?: Set<string>;
    /** Show `name · owner` on every row when the list spans multiple owners. */
    multiOwnerList?: boolean;
  }
): string {
  const show =
    options?.forceOwner ||
    shouldShowScopedOwner(
      name,
      ownerUsername,
      options?.duplicateNames ?? new Set(),
      options?.multiOwnerList ?? false
    );
  if (show && ownerUsername?.trim()) {
    return `${name} · ${ownerUsername.trim()}`;
  }
  return name;
}
