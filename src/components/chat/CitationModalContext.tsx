"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ParsedCitation } from "@/lib/chatCitations";
import { CitationDetailModal } from "@/components/chat/CitationDetailModal";

interface CitationModalContextValue {
  openCitation: (citation: ParsedCitation) => void;
}

const CitationModalContext = createContext<CitationModalContextValue | null>(null);

export function CitationModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [citation, setCitation] = useState<ParsedCitation | null>(null);

  const openCitation = useCallback((next: ParsedCitation) => {
    setCitation(next);
    setOpen(true);
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setCitation(null);
  }, []);

  const value = useMemo(() => ({ openCitation }), [openCitation]);

  return (
    <CitationModalContext.Provider value={value}>
      {children}
      <CitationDetailModal open={open} onOpenChange={handleOpenChange} citation={citation} />
    </CitationModalContext.Provider>
  );
}

export function useCitationModal(): CitationModalContextValue {
  const ctx = useContext(CitationModalContext);
  if (!ctx) {
    throw new Error("useCitationModal must be used within CitationModalProvider");
  }
  return ctx;
}

export function useCitationModalOptional(): CitationModalContextValue | null {
  return useContext(CitationModalContext);
}
