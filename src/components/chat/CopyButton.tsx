"use client";

import { useCallback, useState, type MouseEvent, type PointerEvent } from "react";
import { Check, Copy } from "lucide-react";
import { copyTextToClipboard } from "@/lib/copyToClipboard";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface CopyButtonProps {
  text: string;
  /** Accessible name and tooltip when idle */
  label?: string;
  disabled?: boolean;
  className?: string;
  size?: "icon" | "sm";
  variant?: "ghost" | "ghostOnPrimary";
}

export function CopyButton({
  text,
  label = "Copy",
  disabled,
  className,
  size = "icon",
  variant = "ghost",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (e?: MouseEvent | PointerEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      if (!text || disabled) return;
      const ok = await copyTextToClipboard(text);
      if (!ok) return;
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    },
    [text, disabled]
  );

  const isDisabled = disabled || !text.trim();

  const button = (
    <Button
      type="button"
      variant="ghost"
      size={size}
      className={cn(
        size === "icon" ? "h-8 w-8 shrink-0" : "h-7 gap-1 px-2",
        variant === "ghostOnPrimary" &&
          "text-primary-foreground/70 hover:bg-primary-foreground/15 hover:text-primary-foreground",
        variant === "ghost" && "text-muted-foreground hover:text-foreground",
        className
      )}
      onClick={handleCopy}
      onPointerDown={(e) => e.stopPropagation()}
      disabled={isDisabled}
      aria-label={copied ? "Copied" : label}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden />
      )}
    </Button>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {copied ? "Copied" : label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
