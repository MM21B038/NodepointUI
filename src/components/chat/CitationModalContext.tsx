"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ParsedCitation } from "@/lib/chatCitations";
import { CitationDetailModal } from "@/components/chat/CitationDetailModal";
import type { CitationLayoutMode } from "@/hooks/useCitationLayoutMode";

export type CitationLayout = CitationLayoutMode;

interface CitationModalContextValue {
  openCitation: (citation: ParsedCitation) => void;
  closeCitation: () => void;
  isOpen: boolean;
  isPanelOpen: boolean;
  citation: ParsedCitation | null;
  layout: CitationLayout;
}

type CitationModalInternalValue = CitationModalContextValue & {
  setLayout: (layout: CitationLayout) => void;
};

const CitationModalContext = createContext<CitationModalInternalValue | null>(null);

export function CitationModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [citation, setCitation] = useState<ParsedCitation | null>(null);
  const [layout, setLayout] = useState<CitationLayout>("modal");

  const closeCitation = useCallback(() => {
    setOpen(false);
    setCitation(null);
  }, []);

  const openCitation = useCallback((next: ParsedCitation) => {
    setCitation(next);
    setOpen(true);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) closeCitation();
      else setOpen(true);
    },
    [closeCitation]
  );

  const wasPanelRef = useRef(layout === "panel");
  useEffect(() => {
    if (wasPanelRef.current && layout === "modal" && open) {
      closeCitation();
    }
    wasPanelRef.current = layout === "panel";
  }, [layout, open, closeCitation]);

  const isPanelOpen = layout === "panel" && open;

  const value = useMemo(
    () => ({
      openCitation,
      closeCitation,
      isOpen: open,
      isPanelOpen,
      citation,
      layout,
      setLayout,
    }),
    [openCitation, closeCitation, open, isPanelOpen, citation, layout]
  );

  return (
    <CitationModalContext.Provider value={value}>
      {children}
      {layout === "modal" && (
        <CitationDetailModal
          open={open}
          onOpenChange={handleOpenChange}
          citation={citation}
        />
      )}
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

/** @internal Used by CitationSplitLayout to sync panel vs modal from column width */
export function useCitationLayoutReporter(layout: CitationLayout) {
  const setLayout = useContext(CitationModalContext)?.setLayout;
  useEffect(() => {
    setLayout?.(layout);
  }, [layout, setLayout]);
}

/** Full panel state for split layout wiring */
export function useCitationPanel(): CitationModalContextValue {
  return useCitationModal();
}
