import type { CitationKind } from "@/lib/chatCitations";
import { isCitationKind } from "@/lib/chatCitations";

export type RecordKind = CitationKind;

export interface AttributeItem {
  label: string;
  value: string;
}

export interface ReferenceId {
  key: string;
  label: string;
  value: string;
}

export interface EntityViewModel {
  kind: "entity";
  name: string;
  entityType: string | null;
  attributes: AttributeItem[];
  description: string | null;
  fileName: string | null;
  workspace: string | null;
  referenceIds: ReferenceId[];
  metadata: Record<string, string>;
  raw: Record<string, unknown>;
}

export interface RelationEndpoint {
  name: string;
  type: string | null;
  id: string | null;
}

export interface RelationViewModel {
  kind: "relation";
  source: RelationEndpoint;
  target: RelationEndpoint;
  relationLabel: string | null;
  relationType: string | null;
  description: string | null;
  keywords: string | null;
  score: number | null;
  fileName: string | null;
  workspace: string | null;
  referenceIds: ReferenceId[];
  metadata: Record<string, string>;
  raw: Record<string, unknown>;
}

export interface ChunkViewModel {
  kind: "chunk";
  text: string;
  chunkIndex: number | null;
  sectionTitle: string | null;
  fileName: string | null;
  workspace: string | null;
  referenceIds: ReferenceId[];
  metadata: Record<string, string>;
  raw: Record<string, unknown>;
}

export interface DocumentViewModel {
  kind: "doc";
  title: string;
  body: string;
  isMarkdown: boolean;
  fileName: string | null;
  workspace: string | null;
  referenceIds: ReferenceId[];
  metadata: Record<string, string>;
  raw: Record<string, unknown>;
}

export type KnowledgeViewModel =
  | EntityViewModel
  | RelationViewModel
  | ChunkViewModel
  | DocumentViewModel;

const REF_ID_KEYS: { key: string; label: string }[] = [
  { key: "id", label: "id" },
  { key: "uuid", label: "id" },
  { key: "chunk_id", label: "chunk_id" },
  { key: "document_id", label: "document_id" },
  { key: "source_id", label: "source_id" },
  { key: "target_id", label: "target_id" },
];

const META_KEYS = new Set([
  "created_at",
  "updated_at",
  "vector",
  "embedding",
  "kind",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function str(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

export function resolveRecordKind(
  record: Record<string, unknown>,
  citationKind: CitationKind
): RecordKind {
  const k = str(record.kind)?.toLowerCase();
  if (k === "document") return "doc";
  if (k && isCitationKind(k)) return k;
  return citationKind;
}

export function parseAttributes(attrs: unknown): AttributeItem[] {
  const obj = asRecord(attrs);
  if (!obj) return [];
  return Object.entries(obj)
    .map(([label, value]) => {
      if (value == null) return null;
      const text =
        typeof value === "object"
          ? JSON.stringify(value, null, 2)
          : String(value).trim();
      if (!text) return null;
      return { label, value: text };
    })
    .filter((item): item is AttributeItem => item != null);
}

function collectReferenceIds(
  obj: Record<string, unknown>,
  excludeKeys: Set<string> = new Set()
): ReferenceId[] {
  const seen = new Set<string>();
  const refs: ReferenceId[] = [];

  for (const { key, label } of REF_ID_KEYS) {
    if (excludeKeys.has(key)) continue;
    const value = str(obj[key]);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    refs.push({ key: label, label, value });
  }

  return refs;
}

function collectMetadata(
  obj: Record<string, unknown>,
  usedKeys: Set<string>
): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (usedKeys.has(key) || value == null || value === "") continue;
    if (!META_KEYS.has(key) && typeof value !== "object") {
      const text = str(value);
      if (text) meta[key] = text;
    } else if (META_KEYS.has(key)) {
      const text = str(value);
      if (text) meta[key] = text;
    }
  }
  return meta;
}

function looksLikeMarkdown(text: string): boolean {
  return /^#{1,6}\s|^\s*[-*]\s|```|\[.+\]\(.+\)/m.test(text);
}

function normalizeEntity(obj: Record<string, unknown>): EntityViewModel {
  const name = str(obj.name) ?? str(obj.label) ?? "Unnamed entity";
  const entityType = str(obj.entity_type) ?? str(obj.type);
  const attributes = parseAttributes(obj.attributes);
  const description =
    str(obj.description) ??
    attributes.find((a) => a.label === "description")?.value ??
    null;

  const usedKeys = new Set([
    "name",
    "label",
    "entity_type",
    "type",
    "attributes",
    "description",
    "kind",
    "id",
    "uuid",
    "chunk_id",
    "document_id",
    "file_name",
    "workspace",
    "vector",
    "embedding",
  ]);

  return {
    kind: "entity",
    name,
    entityType,
    attributes: attributes.filter((a) => a.label !== "description"),
    description,
    fileName: str(obj.file_name),
    workspace: str(obj.workspace),
    referenceIds: collectReferenceIds(obj),
    metadata: collectMetadata(obj, usedKeys),
    raw: obj,
  };
}

function readEndpoint(
  obj: Record<string, unknown>,
  prefix: "source" | "target"
): RelationEndpoint {
  const nested = asRecord(obj[`${prefix}_entity`]) ?? asRecord(obj[prefix]);
  if (nested) {
    return {
      name: str(nested.name) ?? str(obj[`${prefix}_name`]) ?? str(obj[prefix]) ?? "—",
      type: str(nested.entity_type) ?? str(nested.type) ?? str(obj[`${prefix}_type`]),
      id: str(nested.id) ?? str(obj[`${prefix}_id`]),
    };
  }
  return {
    name: str(obj[`${prefix}_name`]) ?? str(obj[prefix]) ?? "—",
    type: str(obj[`${prefix}_type`]),
    id: str(obj[`${prefix}_id`]),
  };
}

function normalizeRelation(obj: Record<string, unknown>): RelationViewModel {
  const source = readEndpoint(obj, "source");
  const target = readEndpoint(obj, "target");
  const relationLabel =
    str(obj.relation) ?? str(obj.label) ?? str(obj.name) ?? str(obj.predicate);
  const relationType = str(obj.relation_type) ?? str(obj.type);

  const usedKeys = new Set([
    "source",
    "target",
    "source_name",
    "target_name",
    "source_type",
    "target_type",
    "source_id",
    "target_id",
    "source_entity",
    "target_entity",
    "relation",
    "label",
    "name",
    "predicate",
    "relation_type",
    "type",
    "description",
    "keywords",
    "score",
    "kind",
    "id",
    "uuid",
    "chunk_id",
    "document_id",
    "file_name",
    "workspace",
  ]);

  return {
    kind: "relation",
    source,
    target,
    relationLabel,
    relationType,
    description: str(obj.description),
    keywords: str(obj.keywords),
    score: num(obj.score),
    fileName: str(obj.file_name),
    workspace: str(obj.workspace),
    referenceIds: collectReferenceIds(obj),
    metadata: collectMetadata(obj, usedKeys),
    raw: obj,
  };
}

function normalizeChunk(obj: Record<string, unknown>): ChunkViewModel {
  const text =
    str(obj.text) ??
    str(obj.chunk_text) ??
    str(obj.content) ??
    str(obj.body) ??
    "";

  const usedKeys = new Set([
    "text",
    "chunk_text",
    "content",
    "body",
    "chunk_index",
    "index",
    "section_title",
    "title",
    "kind",
    "id",
    "uuid",
    "chunk_id",
    "document_id",
    "file_name",
    "workspace",
  ]);

  return {
    kind: "chunk",
    text,
    chunkIndex: num(obj.chunk_index) ?? num(obj.index),
    sectionTitle: str(obj.section_title) ?? str(obj.title),
    fileName: str(obj.file_name),
    workspace: str(obj.workspace),
    referenceIds: collectReferenceIds(obj),
    metadata: collectMetadata(obj, usedKeys),
    raw: obj,
  };
}

function normalizeDocument(obj: Record<string, unknown>): DocumentViewModel {
  const body =
    str(obj.content) ??
    str(obj.markdown) ??
    str(obj.text) ??
    str(obj.body) ??
    "";
  const title = str(obj.title) ?? str(obj.file_name) ?? str(obj.name) ?? "Document";

  const usedKeys = new Set([
    "content",
    "markdown",
    "text",
    "body",
    "title",
    "name",
    "file_name",
    "kind",
    "id",
    "uuid",
    "document_id",
    "workspace",
  ]);

  return {
    kind: "doc",
    title,
    body,
    isMarkdown: looksLikeMarkdown(body),
    fileName: str(obj.file_name),
    workspace: str(obj.workspace),
    referenceIds: collectReferenceIds(obj),
    metadata: collectMetadata(obj, usedKeys),
    raw: obj,
  };
}

export function normalizeKnowledgeRecord(
  record: unknown,
  citationKind: CitationKind
): KnowledgeViewModel | null {
  const obj = asRecord(record);
  if (!obj) return null;

  const kind = resolveRecordKind(obj, citationKind);
  switch (kind) {
    case "entity":
      return normalizeEntity(obj);
    case "relation":
      return normalizeRelation(obj);
    case "chunk":
      return normalizeChunk(obj);
    case "doc":
      return normalizeDocument(obj);
    default:
      return normalizeEntity(obj);
  }
}

export function getReferenceIds(vm: KnowledgeViewModel): ReferenceId[] {
  return vm.referenceIds;
}

export function formatRecordAsJson(record: unknown): string {
  try {
    return JSON.stringify(record, null, 2);
  } catch {
    return String(record);
  }
}

export function formatRecordAsText(vm: KnowledgeViewModel): string {
  const lines: string[] = [];

  switch (vm.kind) {
    case "entity": {
      lines.push(vm.name);
      if (vm.entityType) lines.push(`Type: ${vm.entityType}`);
      if (vm.description) lines.push(`\n${vm.description}`);
      if (vm.attributes.length > 0) {
        lines.push("\nAttributes:");
        for (const a of vm.attributes) lines.push(`  ${a.label}: ${a.value}`);
      }
      if (vm.fileName) lines.push(`\nFile: ${vm.fileName}`);
      if (vm.workspace) lines.push(`Workspace: ${vm.workspace}`);
      break;
    }
    case "relation": {
      lines.push(`${vm.source.name} → ${vm.target.name}`);
      if (vm.relationLabel) lines.push(`Relation: ${vm.relationLabel}`);
      if (vm.relationType) lines.push(`Type: ${vm.relationType}`);
      if (vm.description) lines.push(`\n${vm.description}`);
      if (vm.keywords) lines.push(`Keywords: ${vm.keywords}`);
      if (vm.score != null) lines.push(`Score: ${vm.score}`);
      break;
    }
    case "chunk": {
      if (vm.sectionTitle) lines.push(vm.sectionTitle);
      if (vm.chunkIndex != null) lines.push(`Chunk #${vm.chunkIndex}`);
      lines.push("\n" + vm.text);
      if (vm.fileName) lines.push(`\nFile: ${vm.fileName}`);
      break;
    }
    case "doc": {
      lines.push(vm.title);
      if (vm.fileName) lines.push(`File: ${vm.fileName}`);
      lines.push("\n" + vm.body);
      break;
    }
  }

  for (const ref of vm.referenceIds) {
    lines.push(`${ref.label}: ${ref.value}`);
  }

  return lines.join("\n").trim();
}

export function getViewModelTitle(vm: KnowledgeViewModel): string {
  switch (vm.kind) {
    case "entity":
      return vm.name;
    case "relation":
      return vm.relationLabel ?? `${vm.source.name} → ${vm.target.name}`;
    case "chunk":
      return vm.sectionTitle ?? vm.fileName ?? "Chunk";
    case "doc":
      return vm.title;
  }
}
