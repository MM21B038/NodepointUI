"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listSelectableGroups,
  listWorkspaceGroups,
  type GroupTag,
  type WorkspaceGroupSummary,
  type WorkspacePagePagination,
} from "@/database/workspaceStorage";
import { groupSearchText } from "@/lib/groupTag";

const EMPTY_PAGINATION: WorkspacePagePagination = {
  page: 1,
  page_size: 8,
  total_items: 0,
  total_pages: 0,
  has_next: false,
  has_previous: false,
};

export interface UseGroupDirectoryOptions {
  page: number;
  pageSize: number;
  searchQuery: string;
  tagFilter?: GroupTag | "all";
  enabled?: boolean;
}

export function useGroupDirectory({
  page,
  pageSize,
  searchQuery,
  tagFilter = "all",
  enabled = true,
}: UseGroupDirectoryOptions) {
  const [groups, setGroups] = useState<WorkspaceGroupSummary[]>([]);
  const [pagination, setPagination] =
    useState<WorkspacePagePagination>(EMPTY_PAGINATION);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isPaging, setIsPaging] = useState(false);

  const fullListCacheRef = useRef<WorkspaceGroupSummary[] | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const requestIdRef = useRef(0);
  const [reloadKey, setReloadKey] = useState(0);

  const isSearchActive = searchQuery.trim().length > 0;

  const invalidateCache = useCallback(() => {
    fullListCacheRef.current = null;
  }, []);

  const reload = useCallback(() => {
    invalidateCache();
    setReloadKey((k) => k + 1);
  }, [invalidateCache]);

  const applyClientFilter = useCallback(
    (all: WorkspaceGroupSummary[]) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return all;
      return all.filter((g) => groupSearchText(g).includes(q));
    },
    [searchQuery]
  );

  useEffect(() => {
    if (!enabled) return;

    const requestId = ++requestIdRef.current;
    const showPaging = hasLoadedOnceRef.current;

    if (!showPaging) setIsInitialLoading(true);
    else setIsPaging(true);

    const run = async () => {
      try {
        if (isSearchActive || tagFilter === "all") {
          if (!fullListCacheRef.current) {
            fullListCacheRef.current = await listSelectableGroups();
          }
          if (requestId !== requestIdRef.current) return;

          let filtered = fullListCacheRef.current;
          if (tagFilter !== "all") {
            filtered = filtered.filter((g) => g.tag === tagFilter);
          }
          filtered = applyClientFilter(filtered);
          filtered.sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime() ||
              a.name.localeCompare(b.name)
          );

          const total_items = filtered.length;
          const total_pages =
            total_items === 0 ? 0 : Math.max(1, Math.ceil(total_items / pageSize));
          const safePage =
            total_items === 0 ? 1 : Math.min(Math.max(1, page), total_pages);
          const start = (safePage - 1) * pageSize;

          setGroups(filtered.slice(start, start + pageSize));
          setPagination({
            page: safePage,
            page_size: pageSize,
            total_items,
            total_pages,
            has_next: safePage < total_pages,
            has_previous: safePage > 1,
          });
        } else {
          const res = await listWorkspaceGroups({
            page,
            page_size: pageSize,
            tag: tagFilter,
          });
          if (requestId !== requestIdRef.current) return;
          const filtered = applyClientFilter(
            res.groups.filter((g) => g.name !== "flagged" && !g.is_system)
          );
          setGroups(filtered);
          setPagination(res.pagination);
        }

        hasLoadedOnceRef.current = true;
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        console.error("Failed to load groups:", error);
        if (!hasLoadedOnceRef.current) {
          setGroups([]);
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
  }, [enabled, page, pageSize, searchQuery, tagFilter, reloadKey, isSearchActive, applyClientFilter]);

  useEffect(() => {
    if (!enabled) return;
    fullListCacheRef.current = null;
  }, [enabled, reloadKey, tagFilter]);

  return {
    groups,
    pagination,
    isInitialLoading,
    isPaging,
    isSearchActive,
    invalidateCache,
    reload,
  };
}
