import { cn } from "@/lib/utils";
import { brand } from "@/lib/brandColors";

export type DirectoryCardAccent = "workspace" | "group";

const accentStyles: Record<
  DirectoryCardAccent,
  { icon: string; activeIcon: string; stripe: string; tag: string; action: string }
> = {
  workspace: {
    icon: cn(brand.workspace.bg, brand.workspace.text, brand.workspace.border, "border"),
    activeIcon: "bg-primary/12 text-primary border-primary/20 border",
    stripe: "from-brand-workspace/70 via-primary/50 to-transparent",
    tag: cn(brand.workspace.border, brand.workspace.bg, brand.workspace.text, "border"),
    action: cn(
      brand.workspace.border,
      brand.workspace.bgSubtle,
      brand.workspace.text,
      "border hover:bg-brand-workspace/15"
    ),
  },
  group: {
    icon: cn(brand.group.bg, brand.group.text, brand.group.border, "border"),
    activeIcon: "bg-primary/12 text-primary border-primary/20 border",
    stripe: "from-brand-group/70 via-primary/50 to-transparent",
    tag: cn(brand.group.border, brand.group.bg, brand.group.text, "border"),
    action: cn(
      brand.group.border,
      brand.group.bgSubtle,
      brand.group.text,
      "border hover:bg-brand-group/15"
    ),
  },
};

export function directoryCardAccentActionClass(accent: DirectoryCardAccent) {
  return cn(
    "h-9 w-full gap-2 border font-medium",
    accentStyles[accent].action
  );
}

export function directoryCardSurfaceClass(options: {
  accent: DirectoryCardAccent;
  isActive: boolean;
  isSelected: boolean;
  className?: string;
}) {
  return cn(
    "group/card relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-xl border shadow-sm transition-all duration-200",
    "hover:-translate-y-0.5 hover:border-border/80 hover:shadow-md",
    options.isActive
      ? "border-primary/35 bg-gradient-to-br from-primary/[0.06] via-card to-card shadow-md ring-1 ring-primary/15"
      : "border-border/60 bg-card",
    options.isSelected && "ring-2 ring-primary/30 border-primary/25",
    options.className
  );
}

export function directoryCardStripeClass(
  accent: DirectoryCardAccent,
  isActive: boolean
) {
  const palette = accentStyles[accent];
  return cn(
    "absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-90",
    isActive ? palette.stripe : "from-border via-muted to-transparent opacity-50"
  );
}

export function directoryIconWrapClass(
  accent: DirectoryCardAccent,
  isActive: boolean
) {
  const palette = accentStyles[accent];
  return cn(
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
    isActive ? palette.activeIcon : palette.icon
  );
}

export function directoryTagClass(
  accent: DirectoryCardAccent,
  toneClass?: string
) {
  return cn(
    "inline-flex max-w-[7rem] items-center gap-1 rounded-md border px-2 py-0.5",
    "text-[10px] font-semibold uppercase tracking-wide",
    toneClass ?? accentStyles[accent].tag
  );
}

export function directoryCardActionClusterClass() {
  return "flex shrink-0 items-center gap-1.5";
}

export function directoryCardHeaderClass() {
  return cn(
    "relative shrink-0 border-b border-border/50",
    "bg-gradient-to-b from-muted/30 via-muted/10 to-transparent px-4 pb-3 pt-3.5"
  );
}

export function directoryCardBodyClass() {
  return "flex min-h-0 flex-1 flex-col gap-2 p-3 pt-2.5";
}

export function directoryActiveBadgeClass() {
  return cn(
    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
    brand.success.border,
    brand.success.bg,
    brand.success.text
  );
}

export function directoryStatGridClass() {
  return "grid grid-cols-2 gap-2 rounded-lg border border-border/50 bg-muted/30 p-2.5";
}

export function directoryDescriptionPanelClass(accent: DirectoryCardAccent) {
  return cn(
    "mt-2 rounded-md border border-border/40 bg-muted/20 px-2.5 py-2",
    accent === "workspace"
      ? "border-l-2 border-l-brand-workspace/50 pl-2"
      : "border-l-2 border-l-brand-group/50 pl-2"
  );
}

export function directoryDescriptionClass() {
  return cn(
    "text-xs leading-snug text-muted-foreground line-clamp-2 break-words"
  );
}

export function directoryActionsClass() {
  return "flex flex-col gap-2";
}

export function directoryDeleteButtonClass(isVisible: boolean) {
  return cn(
    "h-8 w-8 shrink-0 text-destructive/80 hover:bg-destructive/10 hover:text-destructive",
    "transition-all duration-200",
    isVisible
      ? "opacity-100"
      : "pointer-events-none opacity-0 group-hover/card:pointer-events-auto group-hover/card:opacity-100"
  );
}
