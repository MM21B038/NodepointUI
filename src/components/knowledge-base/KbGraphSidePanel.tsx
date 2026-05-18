"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export interface KbGraphSidePanelProps {
  title: string;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  toolbar?: React.ReactNode;
  className?: string;
}

/** Shared shell for KB graph filter panels and entity detail — full height, header + scroll body. */
export function KbGraphSidePanel({
  title,
  icon,
  onClose,
  children,
  toolbar,
  className,
}: KbGraphSidePanelProps) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg border border-border/60",
        "bg-background/95 shadow-lg backdrop-blur-md",
        className
      )}
    >
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border/60 px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {icon ? <span className="shrink-0 text-muted-foreground">{icon}</span> : null}
          <h2 className="truncate text-sm font-semibold tracking-tight">{title}</h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onClose}
          title="Close panel"
        >
          <X className="h-4 w-4" />
        </Button>
      </header>

      {toolbar ? (
        <div className="shrink-0 border-b border-border/60 px-4 py-3">{toolbar}</div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 scroll-smooth [-webkit-overflow-scrolling:touch]">
        {children}
      </div>
    </div>
  );
}
