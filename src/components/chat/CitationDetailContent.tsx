"use client";

import { AlertCircle, Loader2, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CitationTag } from "@/components/chat/CitationTag";
import { KnowledgeRecordPanel } from "@/components/chat/knowledge/KnowledgeRecordViews";
import { useCitationDetail } from "@/components/chat/useCitationDetail";
import {
  CITATION_KIND_LABELS,
  extractCitationResourceId,
  type ParsedCitation,
} from "@/lib/chatCitations";
import { cn } from "@/lib/utils";

export type CitationDetailVariant = "modal" | "panel";

export interface CitationDetailContentProps {
  citation: ParsedCitation;
  enabled?: boolean;
  onClose?: () => void;
  showCloseButton?: boolean;
  variant?: CitationDetailVariant;
  /** Unique prefix for form control ids when multiple instances exist */
  idPrefix?: string;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
}

export function CitationDetailContent({
  citation,
  enabled = true,
  onClose,
  showCloseButton = false,
  variant = "modal",
  idPrefix = "citation",
  className,
  headerClassName,
  bodyClassName,
}: CitationDetailContentProps) {
  const isPanel = variant === "panel";
  const {
    loading,
    selectLoading,
    error,
    options,
    activeId,
    activeRecord,
    handleSelectId,
    showIdSelect,
  } = useCitationDetail(citation, enabled);

  const recordSelectId = `${idPrefix}-record-id`;
  const displayId =
    activeId ??
    extractCitationResourceId(citation) ??
    (citation.label.trim() || null);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <header
        className={cn(
          "relative shrink-0 border-b",
          isPanel ? "px-4 py-3" : "px-4 py-4 sm:px-6 sm:py-5",
          showCloseButton && "pr-10",
          headerClassName
        )}
      >
        {showCloseButton && onClose && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1.5 top-1.5 h-8 w-8"
            onClick={onClose}
            aria-label="Close citation details"
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        <div className="flex min-w-0 flex-wrap items-center gap-2 pr-1">
          <CitationTag kind={citation.kind} label="" interactive={false} />
          {showIdSelect && activeId ? (
            <Select value={activeId} onValueChange={handleSelectId} disabled={selectLoading}>
              <SelectTrigger
                id={recordSelectId}
                className={cn(
                  "h-8 min-w-0 flex-1 font-mono text-xs",
                  isPanel ? "max-w-full" : "max-w-md"
                )}
              >
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
          ) : displayId ? (
            <span className="min-w-0 flex-1 break-all font-mono text-xs text-muted-foreground">
              {displayId}
            </span>
          ) : null}
        </div>
        <p className="sr-only">
          Knowledge {CITATION_KIND_LABELS[citation.kind]}
          {displayId ? `: ${displayId}` : ""}
        </p>
      </header>

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain",
          isPanel ? "px-4 py-3" : "px-4 py-4 sm:px-6",
          bodyClassName
        )}
      >
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

        {!loading && !error && activeRecord != null && (
          <div className={cn(selectLoading && "pointer-events-none opacity-60")}>
            {selectLoading && (
              <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Updating…
              </div>
            )}
            <KnowledgeRecordPanel
              record={activeRecord}
              citationKind={citation.kind}
              compact={isPanel}
            />
          </div>
        )}
      </div>
    </div>
  );
}
