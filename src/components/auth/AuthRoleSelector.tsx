"use client";

import { Check } from "lucide-react";
import {
  AUTH_ROLE_ORDER,
  getAuthRole,
  type AuthRole,
} from "@/lib/authRoleConfig";
import { cn } from "@/lib/utils";

interface AuthRoleSelectorProps {
  value: AuthRole;
  onChange: (role: AuthRole) => void;
  variant?: "hero" | "segment";
  className?: string;
  adminSignupBlocked?: boolean;
}

export default function AuthRoleSelector({
  value,
  onChange,
  variant = "segment",
  className,
  adminSignupBlocked = false,
}: AuthRoleSelectorProps) {
  if (variant === "hero") {
    return (
      <div
        className={cn("grid gap-4 sm:grid-cols-2", className)}
        role="radiogroup"
        aria-label="Account type"
      >
        {AUTH_ROLE_ORDER.map((role) => {
          const config = getAuthRole(role);
          const Icon = config.icon;
          const selected = value === role;

          return (
            <button
              key={role}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(role)}
              className={cn(
                "group relative overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300",
                "motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                config.surfaces.card,
                !selected && config.surfaces.cardHover,
                selected && cn("ring-2 ring-offset-2 ring-offset-background", config.surfaces.ring, config.surfaces.cardSelected),
                !selected && "opacity-90 hover:opacity-100"
              )}
            >
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100",
                  config.surfaces.glow,
                  selected && "opacity-100"
                )}
                aria-hidden
              />

              <div className="relative flex items-start justify-between gap-3">
                <span
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all duration-300",
                    config.surfaces.iconWrap,
                    selected && config.surfaces.iconWrapSelected
                  )}
                >
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                {selected ? (
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full",
                      role === "user" ? "bg-brand-workspace text-white" : "bg-brand-group text-white"
                    )}
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  </span>
                ) : (
                  <span className="h-6 w-6 rounded-full border border-border/60" aria-hidden />
                )}
              </div>

              <div className="relative mt-4 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    {config.label}
                  </p>
                  {role === "admin" && adminSignupBlocked ? (
                    <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
                      May require invite
                    </span>
                  ) : null}
                </div>
                <p className="text-lg font-semibold tracking-tight text-foreground">
                  {config.headline}
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {config.signupBlurb}
                </p>
              </div>

              <ul className="relative mt-4 space-y-2">
                {config.perks.map(({ icon: PerkIcon, text }) => (
                  <li
                    key={text}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border",
                        config.surfaces.perk
                      )}
                    >
                      <PerkIcon className="h-3 w-3" aria-hidden />
                    </span>
                    {text}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative grid w-full grid-cols-2 gap-1 rounded-xl border border-border/50 bg-muted/30 p-1",
        className
      )}
      role="tablist"
      aria-label="Account type"
    >
      {AUTH_ROLE_ORDER.map((role) => {
        const config = getAuthRole(role);
        const Icon = config.icon;
        const selected = value === role;

        return (
          <button
            key={role}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(role)}
            className={cn(
              "relative z-10 flex flex-col items-center gap-1 rounded-lg px-2 py-2 transition-colors sm:flex-row sm:items-center sm:gap-2.5 sm:px-3",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? cn(
                    "bg-background shadow-md ring-1 ring-border/60",
                    role === "user"
                      ? "shadow-brand-workspace/10"
                      : "shadow-brand-group/10"
                  )
                : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                selected ? config.surfaces.iconWrapSelected : config.surfaces.iconWrap
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 text-center sm:text-left">
              <span
                className={cn(
                  "block text-sm font-semibold",
                  selected ? "text-foreground" : undefined
                )}
              >
                {config.headline}
              </span>
              <span className="hidden text-[11px] leading-snug text-muted-foreground sm:block">
                {config.tagline}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
