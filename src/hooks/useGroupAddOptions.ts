import { useCallback, useEffect, useState } from "react";
import {
  getGroupAddOptions,
  type GroupAddOption,
  type GroupTag,
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

export function useGroupAddOptions({
  groupName,
  groupOwner,
  tag,
  candidateOwnerId,
  enabled = true,
  pageSize = 20,
}: {
  groupName: string;
  groupOwner?: OwnerParams;
  tag: GroupTag;
  candidateOwnerId?: number;
  enabled?: boolean;
  pageSize?: number;
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<GroupAddOption[]>([]);
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
  }, [debouncedSearch, candidateOwnerId, groupName, tag]);

  const reload = useCallback(async () => {
    if (!enabled || !groupName) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getGroupAddOptions(groupName, {
        page,
        page_size: pageSize,
        search: debouncedSearch,
        candidateOwnerId,
        expectedTag: tag,
        owner: groupOwner,
      });
      setItems(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setItems([]);
      setPagination(EMPTY_PAGINATION);
      setError(err instanceof Error ? err.message : "Failed to load options.");
    } finally {
      setLoading(false);
    }
  }, [
    enabled,
    groupName,
    groupOwner,
    tag,
    page,
    pageSize,
    debouncedSearch,
    candidateOwnerId,
  ]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    search,
    setSearch,
    page,
    setPage,
    items,
    pagination,
    loading,
    error,
    reload,
  };
}
