import { apiFetch, parseErrorResponse } from "@/database/apiClient";
import type { CitationKind } from "@/lib/chatCitations";

const KIND_API_SEGMENT: Record<CitationKind, string> = {
  entity: "entity",
  relation: "relation",
  chunk: "chunk",
  doc: "document",
};

export interface KnowledgeRecordOption {
  id: string;
  label: string;
  record: unknown;
}

export async function fetchKnowledgeRecord(
  kind: CitationKind,
  id: string
): Promise<unknown> {
  const segment = KIND_API_SEGMENT[kind];
  const response = await apiFetch(
    `/knowledge/${segment}/${encodeURIComponent(id)}/`
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return response.json();
}

const LIST_KEYS = [
  "results",
  "matches",
  "items",
  "records",
  "entities",
  "relations",
  "chunks",
  "documents",
  "alternatives",
  "related",
] as const;

function recordLabel(record: Record<string, unknown>, id: string): string {
  const name =
    record.name ??
    record.title ??
    record.file_name ??
    record.label ??
    record.source ??
    record.target;
  if (typeof name === "string" && name.trim()) return name.trim();
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

function toOption(record: unknown): KnowledgeRecordOption | null {
  if (!record || typeof record !== "object") return null;
  const r = record as Record<string, unknown>;
  const id = r.id ?? r.uuid ?? r.pk;
  if (typeof id !== "string" || !id.trim()) return null;
  return { id: id.trim(), label: recordLabel(r, id), record };
}

/** Extract selectable records from a knowledge GET response. */
export function parseKnowledgeRecordOptions(data: unknown): KnowledgeRecordOption[] {
  if (data == null) return [];

  if (Array.isArray(data)) {
    return data.map(toOption).filter((o): o is KnowledgeRecordOption => o != null);
  }

  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of LIST_KEYS) {
      const arr = obj[key];
      if (Array.isArray(arr) && arr.length > 0) {
        const options = arr.map(toOption).filter((o): o is KnowledgeRecordOption => o != null);
        if (options.length > 0) return options;
      }
    }
    const single = toOption(obj);
    return single ? [single] : [];
  }

  return [];
}

export function findRecordOption(
  options: KnowledgeRecordOption[],
  id: string
): KnowledgeRecordOption | undefined {
  return options.find((o) => o.id === id);
}
