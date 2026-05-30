"use client";

import React, { useMemo, isValidElement } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ExternalLink } from "lucide-react";
import { CopyButton } from "@/components/chat/CopyButton";
import { normalizeChatMarkdown } from "@/lib/normalizeChatMarkdown";
import { normalizeCitationsInMarkdown, resolveCitation } from "@/lib/chatCitations";
import { splitStreamingBlocks } from "@/lib/splitStreamingBlocks";
import { CitationTag } from "@/components/chat/CitationTag";
import { brand } from "@/lib/brandColors";
import { cn } from "@/lib/utils";
import { useThrottledStreamContent } from "@/hooks/useThrottledStreamContent";
import {
  LiveEdgeMark,
  StreamingContentShell,
} from "@/components/chat/StreamingIndicators";

const chatMarkdownBodyClass =
  "chat-markdown font-chat min-w-0 max-w-none text-left text-foreground [text-wrap:pretty] [&_ul_ul]:mt-1.5 [&_ul_ul]:list-[circle] [&_ol_ol]:mt-1.5 [&_ul_ul_ul]:list-[square] [&_a]:break-words [&_li>input[type=checkbox]]:align-middle";

const pendingStreamTextClass =
  "inline whitespace-pre-wrap break-words text-[15px] leading-[1.75] text-foreground";

const MARKDOWN_LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;

function renderStreamingTextWithCitations(text: string): React.ReactNode {
  if (!text) return null;

  const normalized = normalizeCitationsInMarkdown(text);
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  MARKDOWN_LINK_RE.lastIndex = 0;

  while ((match = MARKDOWN_LINK_RE.exec(normalized)) !== null) {
    if (match.index > last) {
      nodes.push(normalized.slice(last, match.index));
    }
    const citation = resolveCitation(match[1], match[2]);
    if (citation) {
      nodes.push(
        <CitationTag key={`cite-${match.index}`} {...citation} href={match[2]} />
      );
    } else {
      nodes.push(match[0]);
    }
    last = match.index + match[0].length;
  }

  if (last < normalized.length) {
    nodes.push(normalized.slice(last));
  }

  if (nodes.length === 0) return normalized;
  if (nodes.length === 1) return nodes[0];
  return <>{nodes}</>;
}

interface ChatMarkdownProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

type AlertKind = "note" | "tip" | "important" | "warning" | "caution";

const ALERT_STYLES: Record<
  AlertKind,
  { label: string; border: string; bg: string; title: string; icon: string }
> = {
  note: {
    label: "Note",
    border: brand.info.border,
    bg: brand.info.bg,
    title: brand.info.text,
    icon: brand.info.text,
  },
  tip: {
    label: "Tip",
    border: brand.success.border,
    bg: brand.success.bg,
    title: brand.success.text,
    icon: brand.success.text,
  },
  important: {
    label: "Important",
    border: brand.group.border,
    bg: brand.group.bg,
    title: brand.group.text,
    icon: brand.group.text,
  },
  warning: {
    label: "Warning",
    border: brand.warning.border,
    bg: brand.warning.bg,
    title: brand.warning.text,
    icon: brand.warning.text,
  },
  caution: {
    label: "Caution",
    border: "border-red-500/40",
    bg: "bg-red-500/10",
    title: "text-red-700 dark:text-red-300",
    icon: "text-red-600",
  },
};

function getTextContent(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getTextContent).join("");
  if (isValidElement(node)) {
    return getTextContent((node.props as { children?: React.ReactNode }).children);
  }
  return "";
}

const ALERT_KIND_PATTERN = "NOTE|TIP|IMPORTANT|WARNING|CAUTION";

function alertMarkerStartRe(kind: AlertKind): RegExp {
  return new RegExp(
    `^(?:>\\s*)?(?:\\*\\*)?\\[!(${kind.toUpperCase()})\\](?:\\*\\*)?\\s*`,
    "i"
  );
}

function stripLeadingAlertMarkers(text: string, kind: AlertKind): string {
  let result = text;
  let prev: string;
  do {
    prev = result;
    result = result.replace(alertMarkerStartRe(kind), "");
  } while (result !== prev);
  return result.trim();
}

function parseAlertKind(text: string): { kind: AlertKind; body: string } | null {
  const match = text.trim().match(
    new RegExp(
      `^(?:>\\s*)?(?:\\*\\*)?\\[!(${ALERT_KIND_PATTERN})\\](?:\\*\\*)?\\s*([\\s\\S]*)`,
      "i"
    )
  );
  if (!match) return null;
  const kind = match[1].toLowerCase() as AlertKind;
  return { kind, body: stripLeadingAlertMarkers(match[2], kind) };
}

function isEmptyReactNode(node: React.ReactNode): boolean {
  if (node == null || node === false) return true;
  if (typeof node === "string") return node.trim() === "";
  if (Array.isArray(node)) return node.every(isEmptyReactNode);
  if (isValidElement(node)) {
    return isEmptyReactNode((node.props as { children?: React.ReactNode }).children);
  }
  return false;
}

function stripAlertFromNode(node: React.ReactNode, kind: AlertKind): React.ReactNode {
  if (node == null || typeof node === "boolean") return null;
  if (typeof node === "string") {
    const stripped = stripLeadingAlertMarkers(node, kind);
    return stripped.length > 0 ? stripped : null;
  }
  if (typeof node === "number") return node;
  if (Array.isArray(node)) {
    const mapped = node
      .map((child) => stripAlertFromNode(child, kind))
      .filter((child) => child != null && !isEmptyReactNode(child));
    if (mapped.length === 0) return null;
    return mapped.length === 1 ? mapped[0] : mapped;
  }
  if (!isValidElement(node)) return node;

  const stripped = stripAlertFromNode(
    (node.props as { children?: React.ReactNode }).children,
    kind
  );
  if (stripped == null || isEmptyReactNode(stripped)) return null;
  return React.cloneElement(node, { key: node.key ?? undefined }, stripped);
}

function AlertCallout({ kind, children }: { kind: AlertKind; children: React.ReactNode }) {
  const style = ALERT_STYLES[kind];
  return (
    <div
      className={cn(
        "my-4 rounded-lg border px-4 py-3",
        style.border,
        style.bg,
        "[&>p]:my-1.5 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0"
      )}
      role="note"
    >
      <p className={cn("mb-2 text-xs font-semibold uppercase tracking-wide", style.title)}>
        {style.label}
      </p>
      <div className="text-sm leading-relaxed text-foreground">{children}</div>
    </div>
  );
}

function stripAlertFromChildren(children: React.ReactNode, kind: AlertKind): React.ReactNode {
  const items = React.Children.toArray(children)
    .map((child) => stripAlertFromNode(child, kind))
    .filter((child) => child != null && !isEmptyReactNode(child));

  if (items.length === 0) return null;
  if (items.length === 1) return items[0];
  return items;
}

function CopyableBlockChrome({
  label,
  copyText,
  copyLabel,
  children,
  headerClassName,
  copyButtonClassName,
}: {
  label: string;
  copyText: string;
  copyLabel: string;
  children: React.ReactNode;
  headerClassName?: string;
  copyButtonClassName?: string;
}) {
  return (
    <div className="group relative my-4 overflow-hidden rounded-lg border border-border shadow-sm">
      <div
        className={cn(
          "flex items-center justify-between gap-2 border-b border-border/80 bg-muted/50 px-3 py-1.5",
          headerClassName
        )}
      >
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <CopyButton
          text={copyText}
          label={copyLabel}
          className={cn("relative z-10 h-7 w-7", copyButtonClassName)}
        />
      </div>
      {children}
    </div>
  );
}

function normalizeCellText(node: React.ReactNode): string {
  return getTextContent(node).replace(/\s+/g, " ").trim();
}

/** Works with native table nodes and react-markdown custom row/cell components. */
function tableNodeToTsv(node: React.ReactNode): string {
  const rows: string[][] = [];

  const isRowLike = (el: React.ReactElement): boolean => {
    const tag = typeof el.type === "string" ? el.type.toLowerCase() : "";
    if (tag === "tr") return true;
    const kids = React.Children.toArray(
      (el.props as { children?: React.ReactNode }).children
    ).filter(isValidElement) as React.ReactElement[];
    if (kids.length === 0) return false;
    return kids.every((k) => {
      const t = typeof k.type === "string" ? k.type.toLowerCase() : "";
      return t === "th" || t === "td" || typeof k.type === "function";
    });
  };

  const isCellLike = (el: React.ReactElement): boolean => {
    const tag = typeof el.type === "string" ? el.type.toLowerCase() : "";
    if (tag === "th" || tag === "td") return true;
    if (isRowLike(el)) return false;
    return typeof el.type === "function";
  };

  const cellsFromRow = (rowEl: React.ReactElement): string[] => {
    const cells: string[] = [];
    const visit = (n: React.ReactNode) => {
      if (n == null || typeof n === "boolean") return;
      if (Array.isArray(n)) {
        n.forEach(visit);
        return;
      }
      if (!isValidElement(n)) return;
      if (isCellLike(n) && !isRowLike(n)) {
        cells.push(normalizeCellText(n));
        return;
      }
      visit((n.props as { children?: React.ReactNode }).children);
    };
    visit((rowEl.props as { children?: React.ReactNode }).children);
    return cells;
  };

  const walk = (n: React.ReactNode) => {
    if (n == null || typeof n === "boolean") return;
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    if (!isValidElement(n)) return;
    if (isRowLike(n)) {
      const cells = cellsFromRow(n);
      if (cells.length > 0) rows.push(cells);
      return;
    }
    walk((n.props as { children?: React.ReactNode }).children);
  };

  walk(node);

  const tsv = rows.map((row) => row.join("\t")).join("\n");
  return tsv.trim() ? tsv : normalizeCellText(node);
}

function extractFencedCode(
  children: React.ReactNode
): { language: string; code: string } | null {
  let match: React.ReactElement | null = null;

  const findCode = (n: React.ReactNode) => {
    if (match) return;
    if (!isValidElement(n)) return;
    const props = n.props as { className?: string; children?: React.ReactNode };
    const className = props.className ?? "";
    const isNativeCode =
      typeof n.type === "string" && n.type.toLowerCase() === "code";
    if (className.includes("language-") || isNativeCode) {
      match = n;
      return;
    }
    React.Children.forEach(props.children, findCode);
  };

  findCode(children);

  if (!match) {
    try {
      const only = React.Children.only(children);
      if (isValidElement(only)) match = only;
    } catch {
      /* not a single child */
    }
  }

  if (!match) return null;

  const props = match.props as { className?: string; children?: React.ReactNode };
  const code = getTextContent(props.children);
  if (!code) return null;

  const langMatch = /language-([\w+#.-]+)/i.exec(props.className ?? "");
  return { language: langMatch?.[1] ?? "", code };
}

function TableBlock({ children }: { children: React.ReactNode }) {
  const tableText = useMemo(() => tableNodeToTsv(children), [children]);

  return (
    <CopyableBlockChrome label="table" copyText={tableText} copyLabel="Copy table">
      <div className="overflow-x-auto [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_table]:text-sm [&_thead]:bg-muted/60 [&_tr]:border-b [&_tr]:border-border/60 [&_tr:last-child]:border-0 [&_th]:border-b [&_th]:border-border [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:text-sm [&_th]:font-semibold [&_td]:border-b [&_td]:border-border/60 [&_td]:px-4 [&_td]:py-2.5 [&_td]:align-top [&_td]:text-sm">
        <table>{children}</table>
      </div>
    </CopyableBlockChrome>
  );
}

function InlineCode({ children, className, ...props }: React.ComponentPropsWithoutRef<"code">) {
  const text = getTextContent(children);

  return (
    <span className="group/inline-code relative inline-flex max-w-full align-baseline">
      <code
        className={cn(
          "rounded-md border border-border/60 bg-muted/90 px-1.5 py-0.5 font-mono text-[0.9em] text-foreground",
          className
        )}
        {...props}
      >
        {children}
      </code>
      {text.trim() ? (
        <CopyButton
          text={text}
          label="Copy code"
          className="pointer-events-none absolute -right-1 -top-3 z-10 h-6 w-6 opacity-0 shadow-sm transition-opacity group-hover/inline-code:pointer-events-auto group-hover/inline-code:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100"
        />
      ) : null}
    </span>
  );
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const label = language || "code";

  return (
    <CopyableBlockChrome
      label={label}
      copyText={code}
      copyLabel="Copy code"
      headerClassName="border-zinc-700/80 bg-zinc-900/80"
      copyButtonClassName="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
    >
      <pre className="overflow-x-auto bg-zinc-950 p-4 font-mono text-[13px] leading-relaxed text-zinc-50 dark:bg-zinc-900/90">
        <code className={language ? `language-${language}` : undefined}>{code}</code>
      </pre>
    </CopyableBlockChrome>
  );
}

const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="my-3 text-[15px] leading-[1.75] text-foreground first:mt-0 last:mb-0">{children}</p>
  ),
  ul: ({ children, className, ...props }) => (
    <ul
      className={cn(
        "my-3 list-outside list-disc space-y-1.5 pl-6 text-[15px] leading-relaxed",
        className
      )}
      {...props}
    >
      {children}
    </ul>
  ),
  ol: ({ children, className, ...props }) => (
    <ol
      className={cn(
        "my-3 list-outside list-decimal space-y-1.5 pl-6 text-[15px] leading-relaxed",
        className
      )}
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({ children, className, ...props }) => (
    <li
      className={cn(
        "pl-1 leading-relaxed [&>p]:my-1",
        "[&>ul]:my-1.5 [&>ol]:my-1.5",
        className
      )}
      {...props}
    >
      {children}
    </li>
  ),
  a: ({ href, children }) => {
    if (!href) return <span className="text-primary">{children}</span>;
    const safeHref = href.trim();
    const linkText = getTextContent(children);
    const citation = resolveCitation(linkText, safeHref);
    if (citation) {
      return <CitationTag {...citation} href={safeHref} />;
    }
    const isExternal = /^https?:\/\//i.test(safeHref) || safeHref.startsWith("//");
    return (
      <a
        href={safeHref}
        className="inline-flex items-center gap-0.5 font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:text-primary/90 hover:decoration-primary"
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
      >
        {children}
        {isExternal && <ExternalLink className="inline h-3 w-3 shrink-0 opacity-70" aria-hidden />}
      </a>
    );
  },
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic text-foreground">{children}</em>,
  del: ({ children }) => (
    <del className="text-muted-foreground line-through decoration-muted-foreground/80">{children}</del>
  ),
  ins: ({ children }) => <ins className="text-foreground underline">{children}</ins>,
  kbd: ({ children }) => (
    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.85em] shadow-sm">
      {children}
    </kbd>
  ),
  code: ({ className, children, ...props }) => {
    const isFenced = className?.includes("language-");
    if (isFenced) {
      return (
        <code className={cn("font-mono text-[13px] text-inherit", className)} {...props}>
          {children}
        </code>
      );
    }
    return (
      <InlineCode className={className} {...props}>
        {children}
      </InlineCode>
    );
  },
  pre: ({ children }) => {
    const fenced = extractFencedCode(children);
    if (fenced) {
      return <CodeBlock language={fenced.language} code={fenced.code} />;
    }
    const code = getTextContent(children);
    return (
      <CopyableBlockChrome label="code" copyText={code} copyLabel="Copy code">
        <pre className="overflow-x-auto bg-muted/80 p-4 font-mono text-[13px] leading-relaxed">
          {children}
        </pre>
      </CopyableBlockChrome>
    );
  },
  blockquote: ({ children }) => {
    const fullText = getTextContent(children).trim();
    const alert = parseAlertKind(fullText);
    if (alert) {
      const body = stripAlertFromChildren(children, alert.kind);
      return <AlertCallout kind={alert.kind}>{body}</AlertCallout>;
    }
    return (
      <blockquote className="my-4 border-l-4 border-primary/40 bg-muted/30 py-2 pl-4 pr-2 text-muted-foreground [&>p]:text-[15px]">
        {children}
      </blockquote>
    );
  },
  hr: () => <hr className="my-8 border-border" />,
  h1: ({ children }) => (
    <h1 className="mb-4 mt-8 text-2xl font-bold tracking-tight text-foreground first:mt-0 md:text-3xl">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-3 mt-7 border-b border-border pb-2 text-xl font-semibold tracking-tight text-foreground md:text-2xl">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-6 text-lg font-semibold text-foreground">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-2 mt-5 text-base font-semibold text-foreground">{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 className="mb-1.5 mt-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h5>
  ),
  h6: ({ children }) => (
    <h6 className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h6>
  ),
  img: ({ src, alt, title }) => (
    <figure className="my-4">
      <img
        src={src}
        alt={alt ?? ""}
        title={title}
        className="max-h-[420px] w-full max-w-full rounded-lg border border-border object-contain bg-muted/30"
        loading="lazy"
      />
      {(alt || title) && (
        <figcaption className="mt-2 text-center text-xs text-muted-foreground">
          {alt || title}
        </figcaption>
      )}
    </figure>
  ),
  table: ({ children }) => <TableBlock>{children}</TableBlock>,
  input: ({ type, checked, disabled }) => {
    if (type === "checkbox") {
      return (
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          readOnly
          className="mr-2 mt-1 h-3.5 w-3.5 shrink-0 rounded border-border accent-primary"
        />
      );
    }
    return <input type={type} checked={checked} disabled={disabled} readOnly />;
  },
};

function ChatMarkdownBody({
  content,
  isStreaming,
  className,
}: {
  content: string;
  isStreaming?: boolean;
  className?: string;
}) {
  const split = useMemo(
    () => (isStreaming ? splitStreamingBlocks(content) : null),
    [content, isStreaming]
  );

  if (!isStreaming || !split) {
    return (
      <div className={cn(chatMarkdownBodyClass, className)}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {content}
        </ReactMarkdown>
      </div>
    );
  }

  const { committed, pending } = split;
  const hasCommitted = committed.length > 0;
  const hasPending = pending.length > 0;

  return (
    <div className={cn(chatMarkdownBodyClass, className)}>
      {hasCommitted ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {committed}
        </ReactMarkdown>
      ) : null}
      {hasPending ? (
        <span className={pendingStreamTextClass}>
          {renderStreamingTextWithCitations(pending)}
          <LiveEdgeMark />
        </span>
      ) : (
        <LiveEdgeMark />
      )}
    </div>
  );
}

export function ChatMarkdown({ content, isStreaming, className }: ChatMarkdownProps) {
  const normalized = useMemo(() => normalizeChatMarkdown(content), [content]);
  const displayContent = useThrottledStreamContent(
    normalized,
    Boolean(isStreaming),
    100
  );

  if (!normalized && !isStreaming) return null;

  const hasContent = displayContent.length > 0;

  if (isStreaming && !hasContent) {
    return (
      <StreamingContentShell isStreaming hasContent={false}>
        <div className={cn(chatMarkdownBodyClass, className)}>
          <LiveEdgeMark className="mt-0.5" />
        </div>
      </StreamingContentShell>
    );
  }

  return (
    <StreamingContentShell isStreaming={Boolean(isStreaming)} hasContent={hasContent}>
      <ChatMarkdownBody
        content={displayContent}
        isStreaming={isStreaming}
        className={className}
      />
    </StreamingContentShell>
  );
}
