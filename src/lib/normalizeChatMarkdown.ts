import { normalizeCitationsInMarkdown } from "@/lib/chatCitations";

/**
 * Normalize assistant markdown before render (lists, links, notes, code-safe transforms).
 */

const CODE_FENCE_PLACEHOLDER = "\uE000CODE_FENCE_";
const INLINE_CODE_PLACEHOLDER = "\uE000INLINE_CODE_";

export function normalizeChatMarkdown(content: string): string {
  if (!content) return content;

  let text = content.replace(/\r\n/g, "\n");
  const fences: string[] = [];
  const inlines: string[] = [];

  // Protect fenced blocks (including unclosed fence while streaming)
  text = text.replace(/```[^\n]*\n[\s\S]*?(?:```|$)|```[\s\S]*?```/g, (match) => {
    fences.push(match);
    return `${CODE_FENCE_PLACEHOLDER}${fences.length - 1}\uE001`;
  });

  // Protect inline code
  text = text.replace(/`[^`\n]+`/g, (match) => {
    inlines.push(match);
    return `${INLINE_CODE_PLACEHOLDER}${inlines.length - 1}\uE001`;
  });

  text = applyTextTransforms(text);

  text = text.replace(/\uE000INLINE_CODE_(\d+)\uE001/g, (_, i) => inlines[Number(i)] ?? "");
  text = text.replace(/\uE000CODE_FENCE_(\d+)\uE001/g, (_, i) => fences[Number(i)] ?? "");

  return text;
}

function applyTextTransforms(text: string): string {
  // Unescape common markdown escapes from model output
  text = text.replace(/\\([[\]*_#`>~.()+\-|!])/g, "$1");

  // Bullet glyphs → markdown dashes
  text = text.replace(/^(\s*)[•●◦▪‣]\s+/gm, "$1- ");

  // Blank line before lists when glued to prior paragraph
  text = text.replace(/([^\n])\n(\s*[-*+]\s+)/g, "$1\n\n$2");
  text = text.replace(/([^\n])\n(\s*\d+\.\s+)/g, "$1\n\n$2");

  // Blank line before fenced code blocks
  text = text.replace(/([^\n])\n(```)/g, "$1\n\n$2");

  // Blank line before blockquotes (notes)
  text = text.replace(/([^\n])\n(>\s)/g, "$1\n\n$2");

  // Note / Tip / Warning callouts → GFM alerts
  text = text.replace(/^>\s*\*\*Note:?\*\*\s*/gim, "> [!NOTE] ");
  text = text.replace(/^>\s*Note:\s*/gim, "> [!NOTE] ");
  text = text.replace(/^>\s*\*\*Tip:?\*\*\s*/gim, "> [!TIP] ");
  text = text.replace(/^>\s*Tip:\s*/gim, "> [!TIP] ");
  text = text.replace(/^>\s*\*\*Warning:?\*\*\s*/gim, "> [!WARNING] ");
  text = text.replace(/^>\s*Warning:\s*/gim, "> [!WARNING] ");
  text = text.replace(/^>\s*\*\*Important:?\*\*\s*/gim, "> [!IMPORTANT] ");
  text = text.replace(/^>\s*Important:\s*/gim, "> [!IMPORTANT] ");
  text = text.replace(/^>\s*\*\*Caution:?\*\*\s*/gim, "> [!CAUTION] ");
  text = text.replace(/^>\s*Caution:\s*/gim, "> [!CAUTION] ");

  // "label (https://…)" → [label](https://…)
  text = text.replace(
    /(?<!\[)([^\[\n]+?)\s+\((https?:\/\/[^\s)]+)\)/g,
    "[$1]($2)"
  );

  text = normalizeCitationsInMarkdown(text);
  text = autolinkBareUrls(text);

  return text;
}

function autolinkBareUrls(text: string): string {
  const linkPattern = /\[([^\]]*)\]\(([^)]+)\)/g;
  const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const protectedRanges: Array<[number, number]> = [];

  for (const re of [linkPattern, imagePattern]) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      protectedRanges.push([m.index, m.index + m[0].length]);
    }
  }

  const urlRe = /https?:\/\/[^\s<>\])"'`]+/g;
  let result = "";
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = urlRe.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const overlaps = protectedRanges.some(([a, b]) => start < b && end > a);
    result += text.slice(last, start);
    if (overlaps) {
      result += match[0];
    } else {
      let url = match[0];
      let trailing = "";
      while (url.length > 0 && /[.,;:!?)}\]]$/.test(url)) {
        trailing = url.slice(-1) + trailing;
        url = url.slice(0, -1);
      }
      const label = url.length > 48 ? `${url.slice(0, 45)}…` : url;
      result += `[${label}](${url})${trailing}`;
    }
    last = end;
  }

  return result + text.slice(last);
}
