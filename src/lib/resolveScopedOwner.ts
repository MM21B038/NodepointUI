import {
  lookupGroup,
  lookupWorkspace,
  type GroupTag,
  type WorkspaceEntry,
  type WorkspaceGroupSummary,
} from "@/database/workspaceStorage";
import {
  ownerParamsForScopedName,
  ownerParamsFrom,
  type OwnerParams,
} from "@/lib/ownerScope";

export interface ResolvedScopedOwner {
  owner?: OwnerParams;
  ambiguous: boolean;
  matches: WorkspaceGroupSummary[] | WorkspaceEntry[];
}

/** Resolve group owner via cache, optional hint, then `GET /group/lookup/`. */
export async function resolveGroupOwner(
  name: string,
  hintOwnerId?: number | null,
  options?: {
    tag?: GroupTag;
    cache?: WorkspaceGroupSummary[];
    signal?: AbortSignal;
  }
): Promise<ResolvedScopedOwner> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { ambiguous: false, matches: [] };
  }

  const hintOwner: OwnerParams | undefined =
    hintOwnerId != null ? { ownerId: hintOwnerId } : undefined;

  if (options?.cache?.length) {
    const fromCache = ownerParamsForScopedName(
      options.cache,
      trimmed,
      hintOwnerId
    );
    const cacheMatches = options.cache.filter((g) => g.name === trimmed);
    if (fromCache && cacheMatches.length === 1) {
      return {
        owner: fromCache,
        ambiguous: false,
        matches: cacheMatches,
      };
    }
  }

  const lookup = await lookupGroup(trimmed, {
    owner: hintOwner,
    tag: options?.tag,
    signal: options?.signal,
  });

  if (lookup.matches.length === 1) {
    return {
      owner: ownerParamsFrom(lookup.matches[0]),
      ambiguous: false,
      matches: lookup.matches,
    };
  }

  if (hintOwnerId != null && lookup.matches.some((m) => m.owner_id === hintOwnerId)) {
    const match = lookup.matches.find((m) => m.owner_id === hintOwnerId);
    return {
      owner: match ? ownerParamsFrom(match) : undefined,
      ambiguous: lookup.ambiguous,
      matches: lookup.matches,
    };
  }

  return {
    owner: undefined,
    ambiguous: lookup.ambiguous || lookup.matches.length > 1,
    matches: lookup.matches,
  };
}

/** Resolve workspace owner via cache, optional hint, then `GET /workspace/lookup/`. */
export async function resolveWorkspaceOwner(
  name: string,
  hintOwnerId?: number | null,
  options?: {
    cache?: WorkspaceEntry[];
    signal?: AbortSignal;
  }
): Promise<ResolvedScopedOwner> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { ambiguous: false, matches: [] };
  }

  const hintOwner: OwnerParams | undefined =
    hintOwnerId != null ? { ownerId: hintOwnerId } : undefined;

  if (options?.cache?.length) {
    const fromCache = ownerParamsForScopedName(
      options.cache,
      trimmed,
      hintOwnerId
    );
    const cacheMatches = options.cache.filter((w) => w.name === trimmed);
    if (fromCache && cacheMatches.length === 1) {
      return {
        owner: fromCache,
        ambiguous: false,
        matches: cacheMatches,
      };
    }
  }

  const lookup = await lookupWorkspace(trimmed, {
    owner: hintOwner,
    signal: options?.signal,
  });

  if (lookup.matches.length === 1) {
    return {
      owner: ownerParamsFrom(lookup.matches[0]),
      ambiguous: false,
      matches: lookup.matches,
    };
  }

  if (hintOwnerId != null && lookup.matches.some((m) => m.owner_id === hintOwnerId)) {
    const match = lookup.matches.find((m) => m.owner_id === hintOwnerId);
    return {
      owner: match ? ownerParamsFrom(match) : undefined,
      ambiguous: lookup.ambiguous,
      matches: lookup.matches,
    };
  }

  return {
    owner: undefined,
    ambiguous: lookup.ambiguous || lookup.matches.length > 1,
    matches: lookup.matches,
  };
}
