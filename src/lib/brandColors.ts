/**
 * Semantic brand tokens — all values come from CSS variables in globals.css.
 * Use these instead of hard-coded amber/orange/sky/violet Tailwind colors.
 */
export const brand = {
  workspace: {
    text: "text-brand-workspace",
    bg: "bg-brand-workspace/10",
    bgSubtle: "bg-brand-workspace/5",
    border: "border-brand-workspace/25",
    ring: "ring-brand-workspace/20",
  },
  group: {
    text: "text-brand-group",
    bg: "bg-brand-group/10",
    bgSubtle: "bg-brand-group/5",
    border: "border-brand-group/25",
    ring: "ring-brand-group/20",
  },
  chat: {
    text: "text-brand-chat",
    bg: "bg-brand-chat/10",
    bgSubtle: "bg-brand-chat/[0.06]",
    border: "border-brand-chat/25",
    ring: "ring-brand-chat/20",
  },
  success: {
    text: "text-brand-success",
    bg: "bg-brand-success/10",
    border: "border-brand-success/30",
  },
  warning: {
    text: "text-brand-warning",
    bg: "bg-brand-warning/10",
    border: "border-brand-warning/40",
  },
  info: {
    text: "text-brand-info",
    bg: "bg-brand-info/10",
    border: "border-brand-info/30",
  },
} as const;

export const statTone = {
  files: brand.workspace.text,
  chunks: brand.info.text,
  entities: brand.group.text,
  relations: brand.success.text,
} as const;
