"use client";

import { useCallback, useEffect, useState } from "react";
import { extractCitationResourceId, type ParsedCitation } from "@/lib/chatCitations";
import {
  fetchKnowledgeRecord,
  findRecordOption,
  parseKnowledgeRecordOptions,
  type KnowledgeRecordOption,
} from "@/database/knowledgeStorage";

export function useCitationDetail(citation: ParsedCitation | null, enabled: boolean) {
  const [loading, setLoading] = useState(false);
  const [selectLoading, setSelectLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<KnowledgeRecordOption[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeRecord, setActiveRecord] = useState<unknown>(null);

  const loadRecord = useCallback(
    async (kind: ParsedCitation["kind"], id: string, initial = false) => {
      if (initial) {
        setLoading(true);
        setError(null);
        setOptions([]);
        setActiveId(null);
        setActiveRecord(null);
      } else {
        setSelectLoading(true);
      }

      try {
        const data = await fetchKnowledgeRecord(kind, id);
        const list = parseKnowledgeRecordOptions(data);

        if (list.length > 0) {
          setOptions(list);
          const match = findRecordOption(list, id) ?? list[0];
          setActiveId(match.id);
          setActiveRecord(match.record);
        } else {
          setOptions([]);
          setActiveId(id);
          setActiveRecord(data);
        }
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load record");
      } finally {
        if (initial) setLoading(false);
        else setSelectLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!enabled || !citation) return;
    const id = extractCitationResourceId(citation);
    if (!id) {
      setError("Citation has no resource id");
      setLoading(false);
      return;
    }
    void loadRecord(citation.kind, id, true);
  }, [enabled, citation, loadRecord]);

  const handleSelectId = useCallback(
    (newId: string) => {
      if (!citation || newId === activeId) return;
      const existing = findRecordOption(options, newId);
      if (existing) {
        setActiveId(newId);
        setActiveRecord(existing.record);
        setError(null);
        return;
      }
      void loadRecord(citation.kind, newId, false);
    },
    [activeId, citation, loadRecord, options]
  );

  const showIdSelect = options.length > 1;

  return {
    loading,
    selectLoading,
    error,
    options,
    activeId,
    activeRecord,
    handleSelectId,
    showIdSelect,
  };
}
