import { cn } from "@/lib/utils";

/** Outline CTA — brand-chat text + border on off-white surfaces. */
export const chatBrandOutlineButtonClass = cn(
  "border-2 border-brand-chat/70 bg-chat-surface-elevated font-medium text-brand-chat",
  "shadow-none hover:border-brand-chat hover:bg-brand-chat/5",
  "focus-visible:ring-2 focus-visible:ring-brand-chat/25 focus-visible:ring-offset-2",
  "[&_svg]:text-brand-chat",
  "dark:border-brand-chat dark:bg-brand-chat/10"
);

export const chatBrandInputClass = cn(
  "border-border/70 bg-chat-surface-elevated",
  "focus-visible:border-brand-chat/45 focus-visible:ring-brand-chat/20"
);

export const chatDialogSurfaceClass = cn(
  "rounded-2xl border border-border/60 bg-chat-surface-elevated shadow-xl",
  "flex max-h-[min(88vh,640px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[30rem]",
  "!flex"
);

/** User bubble — warm off-white lift, ink text, subtle edge (no blue fill). */
export const chatUserBubbleClass = cn(
  "rounded-2xl rounded-br-sm",
  "border border-chat-surface-user-border bg-chat-surface-user",
  "text-foreground",
  "shadow-[0_1px_2px_hsl(43_20%_20%/0.05),0_4px_12px_hsl(43_20%_20%/0.03)]",
  "dark:border-brand-chat/30 dark:bg-brand-chat/12 dark:shadow-sm"
);

/** Assistant reply container */
export const chatAssistantBubbleClass = cn(
  "rounded-2xl border border-border/50 bg-chat-surface-assistant",
  "font-chat text-[15px] leading-relaxed",
  "shadow-[0_1px_2px_hsl(43_20%_20%/0.04)]",
  "dark:border-border/60 dark:bg-card dark:shadow-sm"
);

/** Chat page canvas + elevated chrome */
export const chatPageCanvasClass = "bg-chat-surface-canvas";
export const chatChromeCardClass = cn(
  "rounded-xl border border-border/50 bg-chat-surface-elevated/90 shadow-sm backdrop-blur-sm",
  "dark:bg-card/90"
);

export const chatComposerShellClass = cn(
  "flex items-end gap-2 rounded-2xl border border-border/50 bg-chat-surface-elevated p-2 shadow-sm",
  "transition-[border-color,box-shadow] duration-300",
  "focus-within:border-brand-chat/40 focus-within:shadow-[0_0_0_1px_hsl(var(--brand-chat)/0.12)]",
  "dark:bg-card"
);
