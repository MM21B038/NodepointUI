/**
 * Split streaming markdown into a safe-to-parse prefix and a plain-text tail.
 * Used while tokens arrive so ReactMarkdown never sees half-formed block syntax.
 */

export interface StreamingBlockSplit {
  committed: string;
  pending: string;
}

const HEADING_RE = /^#{1,6}(?:\s|$)/;
const LIST_RE = /^\s*(?:[-*+]|\d+\.)\s+/;
/** GFM table row or separator line */
const TABLE_LINE_RE = /^\s*\|.*\|?\s*$|^\s*[-:|]+\s*$/;

function normalizeNewlines(content: string): string {
  return content.replace(/\r\n/g, "\n");
}

function isTableLine(line: string): boolean {
  return TABLE_LINE_RE.test(line) || /^\s*\|/.test(line);
}

function isListLine(line: string): boolean {
  return LIST_RE.test(line);
}

function isHeadingLine(line: string): boolean {
  return HEADING_RE.test(line);
}

function blockHasTable(lines: string[]): boolean {
  return lines.some(isTableLine);
}

function blockHasList(lines: string[]): boolean {
  return lines.some(isListLine);
}

/** Index of opening ``` if a fence is still unclosed at end of content. */
export function findUnclosedFenceStart(text: string): number | null {
  const re = /^```[^\n]*(?:\n|$)/gm;
  let inFence = false;
  let start = -1;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (!inFence) {
      inFence = true;
      start = match.index;
    } else {
      inFence = false;
      start = -1;
    }
  }
  return inFence ? start : null;
}

function mergePending(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  if (a.endsWith("\n\n") || b.startsWith("\n\n")) return a + b;
  if (a.endsWith("\n") || b.startsWith("```")) return a + b;
  return `${a}\n\n${b}`;
}

/** True when the tail block must not be parsed as markdown yet. */
function tailBlockIsStructurallyIncomplete(block: string): boolean {
  if (!block) return false;
  const lines = block.split("\n").filter((l, i, arr) => i < arr.length - 1 || l.length > 0);
  if (lines.length === 0) return false;

  if (blockHasTable(lines)) return true;
  if (blockHasList(lines)) return true;

  const first = lines[0];
  const last = lines[lines.length - 1];
  if (isHeadingLine(first) || isHeadingLine(last)) {
    if (!block.endsWith("\n")) return true;
  }

  return false;
}

/** Entire content is one in-flight block (no paragraph break yet). */
function entireContentIsPending(text: string): boolean {
  if (findUnclosedFenceStart(text) !== null) return true;
  const lines = text.split("\n");
  if (blockHasTable(lines)) return true;
  if (blockHasList(lines)) return true;
  if (lines.length === 1 && isHeadingLine(lines[0]) && !text.endsWith("\n")) return true;
  if (lines.some(isHeadingLine) && !text.endsWith("\n")) return true;
  return true;
}

function splitAtLastParagraph(text: string): StreamingBlockSplit {
  const lastBlank = text.lastIndexOf("\n\n");
  if (lastBlank === -1) {
    if (entireContentIsPending(text)) {
      return { committed: "", pending: text };
    }
    return { committed: "", pending: text };
  }

  const committed = text.slice(0, lastBlank);
  const pending = text.slice(lastBlank + 2);
  return { committed, pending };
}

/**
 * Split normalized markdown for streaming render.
 *
 * Rules:
 * - `committed`: complete blocks (joined by `\n\n`) safe for ReactMarkdown.
 * - `pending`: current in-flight block as plain text (always the tail after the last `\n\n`).
 * - Unclosed ``` fences: from the opening fence onward stays pending.
 * - Tables: any `|` table line in the tail block stays pending until a `\n\n` ends that block.
 * - Headings: `#` lines stay pending until the heading line ends with `\n`.
 * - Lists: list-marker lines in the tail block stay pending until the block ends with `\n\n`.
 */
export function splitStreamingBlocks(content: string): StreamingBlockSplit {
  const text = normalizeNewlines(content);
  if (!text) return { committed: "", pending: "" };

  const fenceStart = findUnclosedFenceStart(text);
  if (fenceStart !== null) {
    const before = text.slice(0, fenceStart);
    const fromFence = text.slice(fenceStart);
    const head = splitAtLastParagraph(before);
    return {
      committed: head.committed,
      pending: mergePending(head.pending, fromFence),
    };
  }

  const { committed, pending } = splitAtLastParagraph(text);
  if (!pending) return { committed, pending: "" };

  if (tailBlockIsStructurallyIncomplete(pending)) {
    return { committed, pending };
  }

  return { committed, pending };
}
