"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getAllWorkspaces,
  getWorkspaceCountsByName,
  getWorkspacePage,
  type WorkspaceCounts,
  type WorkspacePageItem,
  type WorkspacePagePagination,
} from "@/database/workspaceStorage";
import { metaSearchText } from "@/lib/resourceMeta";
import { parseResourceKey, workspaceResourceKey } from "@/lib/ownerScope";

const EMPTY_PAGINATION: WorkspacePagePagination = {
  page: 1,
  page_size: 8,
  total_items: 0,
  total_pages: 0,
  has_next: false,
  has_previous: false,
};

const ZERO_COUNTS: WorkspaceCounts = {
  files: 0,
  chunks: 0,
  entities: 0,
  relations: 0,
};

function entryToItem(entry: {
  id?: number;
  name: string;
  owner_id?: number;
  owner_username?: string | null;
  tag?: string | null;
  description?: string | null;
  is_flag: boolean;
  created_at: string;
  groups?: string[];
}): WorkspacePageItem {
  return {
    id: entry.id,
    name: entry.name,
    owner_id: entry.owner_id,
    owner_username: entry.owner_username ?? null,
    tag: entry.tag ?? null,
    description: entry.description ?? null,
    is_flag: entry.is_flag,
    created_at: entry.created_at,
    counts: ZERO_COUNTS,
    groups: entry.groups,
  };
}

function mergeCounts(
  items: WorkspacePageItem[],
  countsByName: Map<string, WorkspaceCounts>
): WorkspacePageItem[] {
  return items.map((w) => ({
    ...w,
    counts:
      countsByName.get(workspaceResourceKey(w.name, w.owner_id)) ??
      countsByName.get(w.name) ??
      w.counts,
  }));
}

export interface UseWorkspaceDirectoryOptions {
  page: number;
  pageSize: number;
  groupFilter: string;
  searchQuery: string;
  enabled?: boolean;
}

/**
 * Workspace grid via GET /workspace/page/?include_counts=true (counts per current page).
 * Name search uses /workspace/list/ (all pages) then hydrates counts in the background.
 */
export function useWorkspaceDirectory({
  page,
  pageSize,
  groupFilter,
  searchQuery,
  enabled = true,
}: UseWorkspaceDirectoryOptions) {
  const [workspaces, setWorkspaces] = useState<WorkspacePageItem[]>([]);
  const [pagination, setPagination] =
    useState<WorkspacePagePagination>(EMPTY_PAGINATION);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isPaging, setIsPaging] = useState(false);
  const [isCountsLoading, setIsCountsLoading] = useState(false);

  const fullListCacheRef = useRef<WorkspacePageItem[] | null>(null);
  const countsCacheRef = useRef<Map<string, WorkspaceCounts> | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const requestIdRef = useRef(0);
  const [reloadKey, setReloadKey] = useState(0);

  const isSearchActive = searchQuery.trim().length > 0;
  const parsedGroupFilter =
    groupFilter !== "all" ? parseResourceKey(groupFilter) : null;
  const serverGroup =
    parsedGroupFilter && !isSearchActive ? parsedGroupFilter.name : undefined;
  const serverGroupOwner =
    parsedGroupFilter?.ownerId != null
      ? { ownerId: parsedGroupFilter.ownerId }
      : undefined;

  const invalidateCache = useCallback(() => {
    fullListCacheRef.current = null;
    countsCacheRef.current = null;
  }, []);

  const reload = useCallback(() => {
    invalidateCache();
    setReloadKey((k) => k + 1);
  }, [invalidateCache]);

  const applySearchPage = useCallback(
    (all: WorkspacePageItem[], targetPage: number, size: number) => {
      const q = searchQuery.trim().toLowerCase();
      let filtered = all;
      if (groupFilter !== "all") {
        const { name: groupName } = parseResourceKey(groupFilter);
        filtered = filtered.filter((w) =>
          (w.groups ?? []).includes(groupName)
        );
      }
      if (q) {
        filtered = filtered.filter((w) => metaSearchText(w).includes(q));
      }
      filtered.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      const total_items = filtered.length;
      const total_pages =
        total_items === 0 ? 0 : Math.max(1, Math.ceil(total_items / size));
      const safePage =
        total_items === 0 ? 1 : Math.min(Math.max(1, targetPage), total_pages);
      const start = (safePage - 1) * size;

      return {
        slice: filtered.slice(start, start + size),
        pagination: {
          page: safePage,
          page_size: size,
          total_items,
          total_pages,
          has_next: safePage < total_pages,
          has_previous: safePage > 1,
        },
      };
    },
    [groupFilter, searchQuery]
  );

  const hydrateSearchCounts = useCallback(
    async (slice: WorkspacePageItem[], requestId: number) => {
      if (slice.length === 0) return;
      setIsCountsLoading(true);
      try {
        if (!countsCacheRef.current) {
          countsCacheRef.current = await getWorkspaceCountsByName();
        }
        if (requestId !== requestIdRef.current) return;
        setWorkspaces((prev) => mergeCounts(prev, countsCacheRef.current!));
      } catch (error) {
        console.error("Failed to load workspace counts:", error);
      } finally {
        if (requestId === requestIdRef.current) {
          setIsCountsLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (!enabled) return;

    const requestId = ++requestIdRef.current;
    const showPaging = hasLoadedOnceRef.current;

    if (!showPaging) {
      setIsInitialLoading(true);
    } else {
      setIsPaging(true);
    }

    const run = async () => {
      try {
        if (isSearchActive) {
          if (!fullListCacheRef.current) {
            const list = await getAllWorkspaces();
            if (requestId !== requestIdRef.current) return;
            fullListCacheRef.current = list.map(entryToItem);
          }
          if (requestId !== requestIdRef.current) return;

          const { slice, pagination: pag } = applySearchPage(
            fullListCacheRef.current,
            page,
            pageSize
          );
          setWorkspaces(slice);
          setPagination(pag);
          hasLoadedOnceRef.current = true;
          void hydrateSearchCounts(slice, requestId);
          return;
        }

        const response = await getWorkspacePage({
          page,
          page_size: pageSize,
          group: serverGroup,
          owner: serverGroupOwner,
          include_counts: true,
        });
        if (requestId !== requestIdRef.current) return;

        setWorkspaces(response.workspaces);
        setPagination(response.pagination);
        hasLoadedOnceRef.current = true;
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        console.error("Failed to load workspaces:", error);
        if (!hasLoadedOnceRef.current) {
          setWorkspaces([]);
          setPagination(EMPTY_PAGINATION);
        }
      } finally {
        if (requestId !== requestIdRef.current) return;
        setIsInitialLoading(false);
        setIsPaging(false);
      }
    };

    void run();

    return () => {
      requestIdRef.current += 1;
    };
  }, [
    enabled,
    page,
    pageSize,
    groupFilter,
    searchQuery,
    isSearchActive,
    serverGroup,
    serverGroupOwner,
    reloadKey,
    applySearchPage,
    hydrateSearchCounts,
  ]);

  useEffect(() => {
    if (!enabled) return;
    fullListCacheRef.current = null;
    countsCacheRef.current = null;
  }, [enabled, reloadKey]);

  return {
    workspaces,
    pagination,
    isInitialLoading,
    isPaging,
    isCountsLoading,
    isSearchActive,
    invalidateCache,
    reload,
  };
}
