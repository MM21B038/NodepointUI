"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CitationTag } from "@/components/chat/CitationTag";
import {
  KnowledgeRecordPanel,
  getViewModelTitle,
} from "@/components/chat/knowledge/KnowledgeRecordViews";
import {
  CITATION_KIND_LABELS,
  extractCitationResourceId,
  type ParsedCitation,
} from "@/lib/chatCitations";
import { normalizeKnowledgeRecord } from "@/lib/knowledgeRecordView";
import {
  fetchKnowledgeRecord,
  findRecordOption,
  parseKnowledgeRecordOptions,
  type KnowledgeRecordOption,
} from "@/database/knowledgeStorage";
import { cn } from "@/lib/utils";

interface CitationDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  citation: ParsedCitation | null;
}

export function CitationDetailModal({ open, onOpenChange, citation }: CitationDetailModalProps) {
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
    if (!open || !citation) return;
    const id = extractCitationResourceId(citation);
    if (!id) {
      setError("Citation has no resource id");
      setLoading(false);
      return;
    }
    void loadRecord(citation.kind, id, true);
  }, [open, citation, loadRecord]);

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

  const headerTitle = useMemo(() => {
    if (!citation) return "";
    if (activeRecord) {
      const vm = normalizeKnowledgeRecord(activeRecord, citation.kind);
      if (vm) return getViewModelTitle(vm);
    }
    if (citation.label.trim()) return citation.label.trim();
    if (activeId) return activeId;
    return CITATION_KIND_LABELS[citation.kind];
  }, [activeId, activeRecord, citation]);

  const showIdSelect = options.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(88vh,720px)] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 space-y-3 border-b px-6 py-5 pr-14 text-left">
          <div className="flex flex-wrap items-center gap-2">
            {citation && <CitationTag kind={citation.kind} label="" interactive={false} />}
            <DialogTitle className="text-base font-semibold leading-snug">{headerTitle}</DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            Knowledge {citation ? CITATION_KIND_LABELS[citation.kind] : "record"} details
          </DialogDescription>

          {showIdSelect && activeId && (
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
              <label
                htmlFor="citation-record-id"
                className="shrink-0 text-xs font-medium text-muted-foreground"
              >
                Record
              </label>
              <Select value={activeId} onValueChange={handleSelectId} disabled={selectLoading}>
                <SelectTrigger id="citation-record-id" className="h-9 font-mono text-xs">
                  <SelectValue placeholder="Select record" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id} className="font-mono text-xs">
                      <span className="text-foreground">{opt.label}</span>
                      <span className="ml-2 text-muted-foreground">{opt.id}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!showIdSelect && activeId && (
            <p className="break-all font-mono text-xs text-muted-foreground">{activeId}</p>
          )}

        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          )}

          {!loading && error && (
            <Alert variant="destructive" className="my-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!loading && !error && activeRecord != null && citation && (
            <div className={cn(selectLoading && "pointer-events-none opacity-60")}>
              {selectLoading && (
                <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Updating…
                </div>
              )}
              <KnowledgeRecordPanel record={activeRecord} citationKind={citation.kind} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
