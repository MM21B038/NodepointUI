import { useCallback, useEffect, useState } from "react";
import {
  getWorkspaceGroupOptions,
  type WorkspaceGroupOption,
  type WorkspacePagePagination,
} from "@/database/workspaceStorage";
import type { OwnerParams } from "@/lib/ownerScope";

const EMPTY_PAGINATION: WorkspacePagePagination = {
  page: 1,
  page_size: 20,
  total_items: 0,
  total_pages: 0,
  has_next: false,
  has_previous: false,
};

export function useWorkspaceGroupOptions({
  workspaceName,
  workspaceOwner,
  enabled = true,
  pageSize = 50,
}: {
  workspaceName: string;
  workspaceOwner?: OwnerParams;
  enabled?: boolean;
  pageSize?: number;
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [groups, setGroups] = useState<WorkspaceGroupOption[]>([]);
  const [pagination, setPagination] =
    useState<WorkspacePagePagination>(EMPTY_PAGINATION);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, workspaceName]);

  const reload = useCallback(async () => {
    if (!enabled || !workspaceName) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getWorkspaceGroupOptions(workspaceName, {
        page,
        page_size: pageSize,
        search: debouncedSearch,
        workspaceOwner,
      });
      setGroups(data.groups);
      setPagination(data.pagination);
    } catch (err) {
      setGroups([]);
      setPagination(EMPTY_PAGINATION);
      setError(err instanceof Error ? err.message : "Failed to load groups.");
    } finally {
      setLoading(false);
    }
  }, [enabled, workspaceName, workspaceOwner, page, pageSize, debouncedSearch]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    search,
    setSearch,
    page,
    setPage,
    groups,
    pagination,
    loading,
    error,
    reload,
  };
}
