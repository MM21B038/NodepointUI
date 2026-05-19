"use client";

import { useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import type { CitationKind } from "@/lib/chatCitations";
import {
  formatRecordAsJson,
  normalizeKnowledgeRecord,
  type KnowledgeViewModel,
  type ReferenceId,
} from "@/lib/knowledgeRecordView";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { CopyableSectionHeader } from "@/components/chat/CopyableSectionHeader";
import { CopyButton } from "@/components/chat/CopyButton";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h4>
  );
}

function formatAttributesCopy(attributes: { label: string; value: string }[]): string {
  return attributes.map((attr) => `${attr.label}: ${attr.value}`).join("\n");
}

function JsonRecordSection({ jsonText }: { jsonText: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t border-border/60 pt-4">
      <div className="flex items-center justify-between gap-2">
        <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs font-medium text-muted-foreground hover:text-foreground">
          <ChevronDown
            className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")}
          />
          Raw JSON
        </CollapsibleTrigger>
        <CopyButton text={jsonText} label="Copy JSON" className="h-7 w-7 shrink-0" />
      </div>
      <CollapsibleContent className="pt-3">
        <pre className="max-h-64 overflow-auto rounded-md border border-border/80 bg-muted/30 p-3 font-mono text-[11px] leading-relaxed text-foreground/90">
          {jsonText}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ReferenceIdsRow({ refs }: { refs: ReferenceId[] }) {
  if (refs.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {refs.map((ref) => (
        <div
          key={`${ref.key}-${ref.value}`}
          className="inline-flex max-w-full items-center gap-1 rounded-md border border-border/80 bg-muted/30 py-0.5 pl-2 pr-0.5"
        >
          <span className="shrink-0 text-[10px] font-medium uppercase text-muted-foreground">
            {ref.label}
          </span>
          <span className="min-w-0 truncate font-mono text-[11px] text-foreground/90 max-w-[140px]">
            {ref.value}
          </span>
          <CopyButton
            text={ref.value}
            label={`Copy ${ref.label}`}
            className="h-7 w-7 shrink-0"
          />
        </div>
      ))}
    </div>
  );
}

function MetadataFooter({ metadata }: { metadata: Record<string, string> }) {
  const entries = Object.entries(metadata);
  if (entries.length === 0) return null;

  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t border-border/60 pt-4">
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 text-left text-xs font-medium text-muted-foreground hover:text-foreground">
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
        />
        Metadata ({entries.length})
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <dl className="grid gap-2 text-sm sm:grid-cols-[minmax(6rem,28%)_1fr]">
          {entries.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="break-all text-xs text-muted-foreground">{key}</dt>
              <dd className="break-words font-mono text-xs text-foreground/90">{value}</dd>
            </div>
          ))}
        </dl>
      </CollapsibleContent>
    </Collapsible>
  );
}

function EntityRecordView({
  vm,
  jsonText,
  compact = false,
}: {
  vm: Extract<KnowledgeViewModel, { kind: "entity" }>;
  jsonText: string;
  compact?: boolean;
}) {
  return (
    <div className={cn(compact ? "space-y-4" : "space-y-5")}>
      {!compact && (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold leading-tight text-foreground">{vm.name}</h3>
          {vm.entityType && (
            <Badge variant="secondary" className="font-mono text-[11px]">
              {vm.entityType}
            </Badge>
          )}
        </div>
        {(vm.fileName || vm.workspace) && (
          <p className="text-xs text-muted-foreground">
            {[vm.fileName, vm.workspace].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
      )}

      {vm.description && (
        <section className="rounded-lg border border-border/80 bg-muted/20 p-4">
          <CopyableSectionHeader title="Description" copyText={vm.description} />
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
            {vm.description}
          </p>
        </section>
      )}

      {vm.attributes.length > 0 && (
        <section className="rounded-lg border border-border/80 bg-muted/20 p-4">
          <CopyableSectionHeader
            title="Attributes"
            copyText={formatAttributesCopy(vm.attributes)}
          />
          <ul className="space-y-2.5">
            {vm.attributes.map((attr) => (
              <li key={attr.label} className="text-sm">
                <span className="font-medium text-foreground">{attr.label}</span>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-muted-foreground">
                  {attr.value}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {vm.referenceIds.length > 0 && (
        <section>
          <SectionTitle>References</SectionTitle>
          <ReferenceIdsRow refs={vm.referenceIds} />
        </section>
      )}

      <MetadataFooter metadata={vm.metadata} />
      <JsonRecordSection jsonText={jsonText} />
    </div>
  );
}

function formatRelationCopy(
  vm: Extract<KnowledgeViewModel, { kind: "relation" }>
): string {
  const lines = [
    `Source: ${vm.source.name}${vm.source.type ? ` (${vm.source.type})` : ""}`,
    `Target: ${vm.target.name}${vm.target.type ? ` (${vm.target.type})` : ""}`,
  ];
  if (vm.relationLabel) lines.push(`Relation: ${vm.relationLabel}`);
  if (vm.relationType) lines.push(`Type: ${vm.relationType}`);
  if (vm.description) lines.push("", vm.description);
  if (vm.keywords) lines.push(`Keywords: ${vm.keywords}`);
  if (vm.score != null) lines.push(`Score: ${vm.score}`);
  return lines.join("\n").trim();
}

function RelationRecordView({
  vm,
  jsonText,
  compact = false,
}: {
  vm: Extract<KnowledgeViewModel, { kind: "relation" }>;
  jsonText: string;
  compact?: boolean;
}) {
  return (
    <div className={cn(compact ? "space-y-4" : "space-y-5")}>
      <section className="rounded-lg border border-border/80 bg-muted/20 p-4">
        <CopyableSectionHeader title="Relationship" copyText={formatRelationCopy(vm)} />
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <EndpointCard label="Source" name={vm.source.name} type={vm.source.type} />
          <div className="flex flex-col items-center gap-1 px-1 text-center">
            <ArrowRight className="h-5 w-5 text-muted-foreground hidden sm:block" />
            <span className="text-xs font-medium text-foreground sm:hidden">→</span>
            {vm.relationLabel && (
              <span className="max-w-[120px] truncate text-xs font-semibold text-foreground">
                {vm.relationLabel}
              </span>
            )}
            {vm.relationType && (
              <Badge variant="outline" className="text-[10px]">
                {vm.relationType}
              </Badge>
            )}
          </div>
          <EndpointCard label="Target" name={vm.target.name} type={vm.target.type} />
        </div>
        {vm.score != null && (
          <p className="mt-3 text-xs text-muted-foreground">Score: {vm.score.toFixed(4)}</p>
        )}
      </section>

      {vm.description && (
        <section className="rounded-lg border border-border/80 bg-muted/20 p-4">
          <CopyableSectionHeader title="Description" copyText={vm.description} />
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{vm.description}</p>
        </section>
      )}

      {vm.keywords && (
        <section>
          <CopyableSectionHeader title="Keywords" copyText={vm.keywords} />
          <p className="text-sm text-muted-foreground">{vm.keywords}</p>
        </section>
      )}

      {(vm.fileName || vm.workspace) && (
        <p className="text-xs text-muted-foreground">
          {[vm.fileName, vm.workspace].filter(Boolean).join(" · ")}
        </p>
      )}

      {vm.referenceIds.length > 0 && (
        <section>
          <SectionTitle>References</SectionTitle>
          <ReferenceIdsRow refs={vm.referenceIds} />
        </section>
      )}

      <MetadataFooter metadata={vm.metadata} />
      <JsonRecordSection jsonText={jsonText} />
    </div>
  );
}

function EndpointCard({
  label,
  name,
  type,
}: {
  label: string;
  name: string;
  type: string | null;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-background/80 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-medium text-foreground">{name}</p>
      {type && (
        <Badge variant="secondary" className="mt-1.5 font-mono text-[10px]">
          {type}
        </Badge>
      )}
    </div>
  );
}

function ChunkRecordView({
  vm,
  jsonText,
  compact = false,
}: {
  vm: Extract<KnowledgeViewModel, { kind: "chunk" }>;
  jsonText: string;
  compact?: boolean;
}) {
  return (
    <div className={cn(compact ? "space-y-4" : "space-y-5")}>
      <section className="rounded-lg border border-border/80 bg-muted/20 p-4">
        <CopyableSectionHeader title="Chunk text" copyText={vm.text} />
        {vm.text ? (
          <div className="max-h-none text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground">
            {vm.text}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No chunk text available.</p>
        )}
      </section>

      {vm.referenceIds.length > 0 && (
        <section>
          <SectionTitle>References</SectionTitle>
          <ReferenceIdsRow refs={vm.referenceIds} />
        </section>
      )}

      <MetadataFooter metadata={vm.metadata} />
      <JsonRecordSection jsonText={jsonText} />
    </div>
  );
}

function DocumentRecordView({
  vm,
  jsonText,
  compact = false,
}: {
  vm: Extract<KnowledgeViewModel, { kind: "doc" }>;
  jsonText: string;
  compact?: boolean;
}) {
  return (
    <div className={cn(compact ? "space-y-4" : "space-y-5")}>
      {!compact && (
        <div>
          <h3 className="text-lg font-semibold text-foreground">{vm.title}</h3>
          {(vm.fileName || vm.workspace) && (
            <p className="mt-1 text-xs text-muted-foreground">
              {[vm.fileName, vm.workspace].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      )}

      <section className="rounded-lg border border-border/80 bg-muted/20 p-4">
        <CopyableSectionHeader title="Document" copyText={vm.body} />
        {vm.body ? (
          vm.isMarkdown ? (
            <ChatMarkdown content={vm.body} className="text-sm" />
          ) : (
            <pre className="text-sm leading-relaxed whitespace-pre-wrap break-words font-sans text-foreground">
              {vm.body}
            </pre>
          )
        ) : (
          <p className="text-sm text-muted-foreground">No document content.</p>
        )}
      </section>

      {vm.referenceIds.length > 0 && (
        <section>
          <SectionTitle>References</SectionTitle>
          <ReferenceIdsRow refs={vm.referenceIds} />
        </section>
      )}

      <MetadataFooter metadata={vm.metadata} />
      <JsonRecordSection jsonText={jsonText} />
    </div>
  );
}

export interface KnowledgeRecordPanelProps {
  record: unknown;
  citationKind: CitationKind;
  /** Side panel: omit hero title blocks already shown in citation header */
  compact?: boolean;
}

export function KnowledgeRecordPanel({
  record,
  citationKind,
  compact = false,
}: KnowledgeRecordPanelProps) {
  const vm = normalizeKnowledgeRecord(record, citationKind);

  if (!vm) {
    return <p className="text-sm text-muted-foreground">Unable to display this record.</p>;
  }

  const jsonText = formatRecordAsJson(
    typeof record === "object" && record != null ? record : vm.raw
  );

  switch (vm.kind) {
    case "entity":
      return <EntityRecordView vm={vm} jsonText={jsonText} compact={compact} />;
    case "relation":
      return <RelationRecordView vm={vm} jsonText={jsonText} compact={compact} />;
    case "chunk":
      return <ChunkRecordView vm={vm} jsonText={jsonText} compact={compact} />;
    case "doc":
      return <DocumentRecordView vm={vm} jsonText={jsonText} compact={compact} />;
  }
}

export { normalizeKnowledgeRecord, getViewModelTitle } from "@/lib/knowledgeRecordView";
export type { KnowledgeViewModel } from "@/lib/knowledgeRecordView";
