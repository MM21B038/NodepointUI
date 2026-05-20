"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getAllWorkspaces,
  getWorkspaceList,
  type WorkspacePageItem,
  type WorkspacePagePagination,
} from "@/database/workspaceStorage";

const EMPTY_PAGINATION: WorkspacePagePagination = {
  page: 1,
  page_size: 8,
  total_items: 0,
  total_pages: 0,
  has_next: false,
  has_previous: false,
};

function entryToItem(entry: {
  name: string;
  is_flag: boolean;
  created_at: string;
  groups?: string[];
}): WorkspacePageItem {
  return {
    name: entry.name,
    is_flag: entry.is_flag,
    created_at: entry.created_at,
    counts: { files: 0, chunks: 0, entities: 0, relations: 0 },
    groups: entry.groups,
  };
}

export interface UseWorkspaceDirectoryOptions {
  page: number;
  pageSize: number;
  groupFilter: string;
  searchQuery: string;
  enabled?: boolean;
}

/**
 * Workspace grid: server pagination via GET /workspace/list/ (and ?group=).
 * Name search loads all pages once, then filters client-side.
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

  const fullListCacheRef = useRef<WorkspacePageItem[] | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const requestIdRef = useRef(0);
  const [reloadKey, setReloadKey] = useState(0);

  const isSearchActive = searchQuery.trim().length > 0;
  const serverGroup =
    groupFilter !== "all" && !isSearchActive ? groupFilter : undefined;

  const invalidateCache = useCallback(() => {
    fullListCacheRef.current = null;
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
        filtered = filtered.filter((w) =>
          (w.groups ?? []).includes(groupFilter)
        );
      }
      if (q) {
        filtered = filtered.filter((w) => w.name.toLowerCase().includes(q));
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

      setWorkspaces(filtered.slice(start, start + size));
      setPagination({
        page: safePage,
        page_size: size,
        total_items,
        total_pages,
        has_next: safePage < total_pages,
        has_previous: safePage > 1,
      });
      hasLoadedOnceRef.current = true;
    },
    [groupFilter, searchQuery]
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
          applySearchPage(fullListCacheRef.current, page, pageSize);
          return;
        }

        const response = await getWorkspaceList({
          page,
          page_size: pageSize,
          group: serverGroup,
        });
        if (requestId !== requestIdRef.current) return;

        setWorkspaces(response.workspaces.map(entryToItem));
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
    reloadKey,
    applySearchPage,
  ]);

  useEffect(() => {
    if (!enabled) return;
    fullListCacheRef.current = null;
  }, [enabled, reloadKey]);

  return {
    workspaces,
    pagination,
    isInitialLoading,
    isPaging,
    isSearchActive,
    invalidateCache,
    reload,
  };
}
