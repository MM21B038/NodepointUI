"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface ChatMarkdownProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

const markdownComponents: Components = {
  hr: () => (
    <div className="my-10 flex items-center gap-3" role="separator">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-muted-foreground/35 to-transparent" />
      <div className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-muted-foreground/35 to-transparent" />
    </div>
  ),
  h1: ({ children }) => (
    <h1 className="mt-8 mb-4 text-2xl font-bold tracking-tight text-foreground first:mt-0 md:text-3xl">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-7 mb-3 border-b border-border pb-2 text-xl font-semibold tracking-tight text-foreground md:text-2xl">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-6 mb-2 text-lg font-semibold text-foreground">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-5 mb-2 text-base font-semibold text-foreground">{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 className="mt-4 mb-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h5>
  ),
  h6: ({ children }) => (
    <h6 className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h6>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  pre: ({ children }) => (
    <pre className="overflow-x-auto font-mono text-[13px] leading-relaxed">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-border shadow-sm">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-border bg-muted/60 px-4 py-3 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border/60 px-4 py-2.5 align-top">{children}</td>
  ),
};

export function ChatMarkdown({ content, isStreaming, className }: ChatMarkdownProps) {
  if (!content && !isStreaming) return null;

  return (
    <div
      className={cn(
        "font-chat prose prose-base dark:prose-invert max-w-none text-foreground",
        "text-left [text-wrap:pretty]",
        "prose-p:my-3 prose-p:leading-[1.75] prose-p:text-[15px]",
        "prose-a:text-primary prose-a:underline-offset-2 hover:prose-a:underline prose-a:font-medium",
        "prose-strong:text-foreground prose-strong:font-semibold",
        "prose-code:rounded-md prose-code:bg-muted/90 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.9em] prose-code:font-normal prose-code:before:content-none prose-code:after:content-none",
        "prose-pre:my-4 prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:p-4 prose-pre:text-[13px] prose-pre:leading-relaxed",
        "prose-blockquote:my-4 prose-blockquote:border-l-4 prose-blockquote:border-primary/40 prose-blockquote:pl-4 prose-blockquote:py-0.5 prose-blockquote:not-italic prose-blockquote:text-muted-foreground",
        "prose-ul:my-4 prose-ol:my-4 prose-ul:pl-6 prose-ol:pl-6",
        "prose-li:my-1.5 prose-li:leading-relaxed prose-li:marker:text-muted-foreground",
        "prose-table:my-4 prose-table:text-[14px]",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-1.5 h-4 ml-0.5 bg-primary/60 animate-pulse align-middle" />
      )}
    </div>
  );
}
