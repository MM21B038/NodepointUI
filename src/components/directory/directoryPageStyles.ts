import { brand } from "@/lib/brandColors";
import { cn } from "@/lib/utils";

export const directoryPagePanelClass =
  "flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-lg";

export const directoryPageScrollClass =
  "relative flex-1 min-h-0 overflow-y-auto bg-muted/20 p-3 sm:p-4 content-start";

export const directoryPageGridClass =
  "grid auto-rows-auto grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

export const directoryToolbarClass =
  "shrink-0 space-y-2 border-b border-border/60 bg-gradient-to-b from-muted/20 to-card px-3 py-2.5 sm:px-4";

export const directoryToolbarRowClass =
  "flex flex-wrap items-center gap-x-3 gap-y-2";

export const directoryToolbarTitleClusterClass =
  "flex shrink-0 items-center gap-2";

export const directoryToolbarDividerClass =
  "hidden h-5 w-px shrink-0 bg-border/70 sm:block";

export const directorySelectionBarClass =
  "flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2";

export const directorySearchInputClass =
  "h-9 border-border/60 bg-background pl-9 shadow-sm focus-visible:ring-primary/30";

export function directoryTitleClass() {
  return "text-lg font-semibold tracking-tight text-foreground";
}

export function directoryTitleIconClass(accent: "workspace" | "group") {
  return cn(
    "flex h-8 w-8 items-center justify-center rounded-lg border",
    accent === "workspace"
      ? cn(brand.workspace.bg, brand.workspace.text, brand.workspace.border)
      : cn(brand.group.bg, brand.group.text, brand.group.border)
  );
}

export function directoryCreateActionClass(accent: "workspace" | "group") {
  return cn(
    "h-8 gap-1.5 border border-dashed px-2.5 text-xs font-medium shadow-none",
    "bg-background/80 hover:bg-muted/40",
    accent === "workspace"
      ? cn(brand.workspace.border, brand.workspace.text)
      : cn(brand.group.border, brand.group.text)
  );
}

export function directoryNavActionClass(accent: "workspace" | "group") {
  return cn(
    "h-8 gap-1.5 border px-2.5 text-xs font-medium shadow-none",
    "bg-background/80 hover:bg-muted/40",
    accent === "workspace"
      ? cn(brand.workspace.border, "text-foreground")
      : cn(brand.group.border, "text-foreground")
  );
}
