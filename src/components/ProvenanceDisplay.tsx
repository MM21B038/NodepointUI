"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import ReactMarkdown from "react-markdown";
import remarkGfm from 'remark-gfm';
import { ProvenanceEntry } from "@/database/workspaceStorage"; // Assuming ProvenanceEntry is defined here or globally

interface ProvenanceDisplayProps {
  provenance: ProvenanceEntry[];
}

const ProvenanceDisplay: React.FC<ProvenanceDisplayProps> = ({ provenance }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!provenance || provenance.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 pt-4 border-t border-primary-foreground/20">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-start text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground px-2 py-1 h-auto transition-all duration-200"
      >
        {isOpen ? (
          <ChevronUp className="h-3 w-3 mr-1" />
        ) : (
          <ChevronDown className="h-3 w-3 mr-1" />
        )}
        Thinking Process | Provenance ({provenance.length})
      </Button>
      {isOpen && (
        <div className="mt-3 space-y-3 text-xs bg-secondary p-3 rounded-lg border border-dashed border-secondary-foreground/20 animate-in fade-in slide-in-from-top-2 duration-300">
          {provenance.map((entry, index) => (
            <div key={index} className="pb-2 border-b border-dashed border-secondary-foreground/10 last:border-b-0">
              <p className="font-semibold text-primary">Source ID: {entry.id}</p>
              <p className="text-muted-foreground italic mt-1">Reason: {entry.reason}</p>
              <p className="text-foreground mt-1 line-clamp-3 prose dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.snippet}</ReactMarkdown>
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProvenanceDisplay;