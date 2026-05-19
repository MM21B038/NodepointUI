"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CitationDetailContent } from "@/components/chat/CitationDetailContent";
import { CITATION_KIND_LABELS, type ParsedCitation } from "@/lib/chatCitations";

interface CitationDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  citation: ParsedCitation | null;
}

export function CitationDetailModal({ open, onOpenChange, citation }: CitationDetailModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(88vh,720px)] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {citation && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>
                Knowledge {CITATION_KIND_LABELS[citation.kind]} details
              </DialogTitle>
              <DialogDescription>
                Citation detail for {citation.kind}
              </DialogDescription>
            </DialogHeader>
            <CitationDetailContent
              citation={citation}
              enabled={open}
              idPrefix="citation-modal"
              className="max-h-[min(88vh,720px)]"
              headerClassName="pr-14"
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
