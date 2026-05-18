/** Knowledge-graph citation kinds returned in chat markdown links. */
export type CitationKind = "entity" | "relation" | "chunk" | "doc";

export interface ParsedCitation {
  kind: CitationKind;
  label: string;
  href?: string;
}

const CITATION_KINDS: CitationKind[] = ["entity", "relation", "chunk", "doc"];

const KIND_LABEL_RE = /^(entity|relation|chunk|doc):\s*(.*)$/i;
const KIND_ONLY_RE = /^(entity|relation|chunk|doc)$/i;
const LEGACY_SOURCE_RE = /\[source:\s*([^\]]+)\]/gi;
const LEGACY_SOURCE_PLAIN_RE = /(?<!\])\bsource:\s*([^\s\],.;)]+)/gi;
const MARKDOWN_LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;

export const CITATION_KIND_LABELS: Record<CitationKind, string> = {
  entity: "Entity",
  relation: "Relation",
  chunk: "Chunk",
  doc: "Doc",
};

export function isCitationKind(value: string): value is CitationKind {
  return (CITATION_KINDS as string[]).includes(value.toLowerCase());
}

function decodePayload(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function basenameFromHref(href: string): string {
  const trimmed = href.replace(/[#?].*$/, "");
  const slash = trimmed.lastIndexOf("/");
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
}

/** Parse kind + payload encoded in a citation href. */
export function extractCitationFromHref(href: string | undefined): ParsedCitation | null {
  if (!href) return null;
  const h = href.trim();
  if (!h || h === "#") return null;

  const hashCitation = parseCitationHref(h);
  if (hashCitation) return hashCitation;

  const citeScheme = /^(?:cite|citation):(entity|relation|chunk|doc):(.+)$/i.exec(h);
  if (citeScheme) {
    return {
      kind: citeScheme[1].toLowerCase() as CitationKind,
      label: decodePayload(citeScheme[2]),
      href: h,
    };
  }

  const kindPrefix = /^(entity|relation|chunk|doc):(.+)$/i.exec(h);
  if (kindPrefix) {
    return {
      kind: kindPrefix[1].toLowerCase() as CitationKind,
      label: decodePayload(kindPrefix[2]),
      href: h,
    };
  }

  const pathMatch = /(?:^|[/:])(entity|relation|chunk|doc)[/:]([^/?#]+)/i.exec(h);
  if (pathMatch) {
    return {
      kind: pathMatch[1].toLowerCase() as CitationKind,
      label: decodePayload(pathMatch[2]),
      href: h,
    };
  }

  try {
    const url = new URL(h, "http://cite.local");
    const typeParam =
      url.searchParams.get("type") ??
      url.searchParams.get("kind") ??
      url.searchParams.get("cite");
    if (typeParam && isCitationKind(typeParam)) {
      const pathSeg = url.pathname.match(/\/(entity|relation|chunk|doc)\/([^/]+)/i);
      const label =
        url.searchParams.get("label") ??
        url.searchParams.get("name") ??
        url.searchParams.get("id") ??
        (pathSeg ? decodePayload(pathSeg[2]) : "") ??
        basenameFromHref(url.pathname);
      if (label && !KIND_ONLY_RE.test(label)) {
        return {
          kind: typeParam.toLowerCase() as CitationKind,
          label: decodePayload(label),
          href: h,
        };
      }
    }
  } catch {
    /* not a URL */
  }

  return null;
}

export function encodeCitationPayload(payload: string): string {
  return encodeURIComponent(payload);
}

export function formatCitationMarkdown(citation: ParsedCitation): string {
  const label = citation.label.trim();
  const resourceId = extractCitationResourceId(citation);
  const payload = resourceId || label || CITATION_KIND_LABELS[citation.kind];
  const display = label || resourceId || CITATION_KIND_LABELS[citation.kind];
  return `[${citation.kind}: ${display}](#citation-${citation.kind}-${encodeCitationPayload(payload)})`;
}

/** Resolve a markdown [label](href) pair into a citation, if any. */
export function resolveCitation(linkText: string, href?: string): ParsedCitation | null {
  const text = linkText.trim();
  const safeHref = href?.trim();

  const fromHash = parseCitationHref(safeHref);
  if (fromHash) return fromHash;

  const labelMatch = text.match(KIND_LABEL_RE);
  if (labelMatch) {
    const kind = labelMatch[1].toLowerCase() as CitationKind;
    const label = labelMatch[2].trim();
    const fromHref = extractCitationFromHref(safeHref);
    return {
      kind,
      label: label || fromHref?.label || "",
      href: safeHref,
    };
  }

  const fromHref = extractCitationFromHref(safeHref);
  if (fromHref) {
    if (KIND_ONLY_RE.test(text)) {
      return { ...fromHref, href: safeHref };
    }
    if (text && text.toLowerCase() !== fromHref.kind) {
      return { kind: fromHref.kind, label: text, href: safeHref };
    }
    return { ...fromHref, href: safeHref };
  }

  const kindOnly = text.match(KIND_ONLY_RE);
  if (kindOnly) {
    const kind = kindOnly[1].toLowerCase() as CitationKind;
    const label =
      safeHref && safeHref !== "#"
        ? decodePayload(basenameFromHref(safeHref))
        : "";
    return { kind, label, href: safeHref };
  }

  return null;
}

/** Convert legacy sources and normalize citation markdown links for rendering. */
export function normalizeCitationsInMarkdown(text: string): string {
  let out = text.replace(LEGACY_SOURCE_RE, (_, file: string) => {
    const name = file.trim();
    return formatCitationMarkdown({ kind: "doc", label: name });
  });

  out = out.replace(LEGACY_SOURCE_PLAIN_RE, (match, file: string, offset: number, whole: string) => {
    const before = whole[offset - 1];
    if (before === "[" || before === "(") return match;
    const name = file.trim();
    return formatCitationMarkdown({ kind: "doc", label: name });
  });

  out = out.replace(MARKDOWN_LINK_RE, (full, label: string, href: string) => {
    const citation = resolveCitation(label, href);
    if (!citation) return full;
    return formatCitationMarkdown(citation);
  });

  return out;
}

export function parseCitationHref(href: string | undefined): ParsedCitation | null {
  if (!href?.startsWith("#citation-")) return null;
  const rest = href.slice("#citation-".length);
  const dash = rest.indexOf("-");
  if (dash <= 0) return null;
  const kindRaw = rest.slice(0, dash);
  if (!isCitationKind(kindRaw)) return null;
  const label = decodeURIComponent(rest.slice(dash + 1));
  return { kind: kindRaw.toLowerCase() as CitationKind, label, href };
}

export function parseCitationFromLink(
  href: string | undefined,
  linkText: string
): ParsedCitation | null {
  return resolveCitation(linkText, href);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Resource id (usually UUID) used for knowledge detail GET routes. */
export function extractCitationResourceId(citation: ParsedCitation): string | null {
  const label = citation.label.trim();
  const href = citation.href?.trim();

  if (href) {
    if (href.startsWith("#citation-")) {
      const parsed = parseCitationHref(href);
      const payload = parsed?.label?.trim();
      if (payload) return payload;
    }

    const citeMatch = /^(?:cite|citation):(entity|relation|chunk|doc):(.+)$/i.exec(href);
    if (citeMatch) return decodePayload(citeMatch[2]).trim() || null;

    const kindMatch = /^(entity|relation|chunk|doc):(.+)$/i.exec(href);
    if (kindMatch) return decodePayload(kindMatch[2]).trim() || null;

    const pathMatch = /\/(entity|relation|chunk|document|doc)\/([^/?#]+)/i.exec(href);
    if (pathMatch) return decodePayload(pathMatch[2]).trim() || null;

    const fromHref = extractCitationFromHref(href);
    if (fromHref?.label?.trim()) return fromHref.label.trim();

    const base = basenameFromHref(href);
    if (base && base !== "#") return decodePayload(base);
  }

  if (UUID_RE.test(label)) return label;
  return label || null;
}
