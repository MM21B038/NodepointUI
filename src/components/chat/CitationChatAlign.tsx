"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Centers chat blocks within the chat column (split layout handles side-by-side grouping). */
export function CitationChatAlign({
  children,
  className,
  maxWidthClass,
}: {
  children: ReactNode;
  className?: string;
  maxWidthClass: string;
}) {
  return (
    <div className={cn("mx-auto w-full", maxWidthClass, className)}>{children}</div>
  );
}
