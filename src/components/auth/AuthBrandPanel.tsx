"use client";

import { Brain, Layers, MessageSquare } from "lucide-react";
import { NodepointLogo } from "@/components/brand/NodepointLogo";
import AuthNodeIllustration from "@/components/auth/AuthNodeIllustration";
import {
  AUTH_ROLE_ORDER,
  getAuthRole,
  type AuthRole,
} from "@/lib/authRoleConfig";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: Layers,
    label: "Structured workspaces",
    description: "Organize knowledge by scope and team",
  },
  {
    icon: Brain,
    label: "Connected graphs",
    description: "Explore entities and relationships",
  },
  {
    icon: MessageSquare,
    label: "Grounded chat",
    description: "Ask questions over your corpus",
  },
] as const;

export default function AuthBrandPanel({
  className,
  highlightRole,
  page = "login",
}: {
  className?: string;
  highlightRole?: AuthRole;
  page?: "login" | "register" | "recover";
}) {
  const activeConfig = highlightRole ? getAuthRole(highlightRole) : null;
  const ActiveIcon = activeConfig?.icon;

  return (
    <div
      className={cn(
        "flex flex-col justify-center gap-8 px-6 py-10 lg:px-10 lg:py-12",
        className
      )}
    >
      <div className="space-y-4 motion-reduce:animate-none animate-auth-fade-up">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className={cn(
                "absolute inset-0 rounded-xl blur-xl motion-reduce:animate-none animate-auth-glow",
                activeConfig ? activeConfig.surfaces.glow : "bg-primary/20"
              )}
            />
            <NodepointLogo size={44} className="relative" />
          </div>
          <div>
            <p className="text-xl font-semibold tracking-tight text-foreground">
              Nodepoint
            </p>
            <p className="text-sm text-muted-foreground">
              Knowledge workspaces, connected
            </p>
          </div>
        </div>
        <p className="max-w-sm text-[15px] leading-relaxed text-muted-foreground">
          {page === "register"
            ? "Create the right account type up front — user for everyday work, admin for operators who manage the platform."
            : page === "recover"
              ? "Use the same account type you originally registered with to restore access during the grace period."
              : "Sign in to manage workspaces, browse knowledge graphs, and chat with context grounded in your documents."}
        </p>
      </div>

      {page === "register" && highlightRole ? (
        <div
          key={highlightRole}
          className={cn(
            "rounded-2xl border p-4 motion-reduce:animate-none animate-auth-fade-up",
            activeConfig?.surfaces.banner
          )}
        >
          <div className="flex items-center gap-3">
            {ActiveIcon ? (
              <span
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-xl",
                  activeConfig?.surfaces.iconWrapSelected
                )}
              >
                <ActiveIcon className="h-5 w-5" aria-hidden />
              </span>
            ) : null}
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Selected · {activeConfig?.label}
              </p>
              <p className="font-semibold text-foreground">{activeConfig?.headline}</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2">
            {activeConfig?.perks.map(({ icon: PerkIcon, text }) => (
              <li
                key={text}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-md border",
                    activeConfig.surfaces.perk
                  )}
                >
                  <PerkIcon className="h-3 w-3" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <AuthNodeIllustration className="motion-reduce:animate-none animate-auth-fade-up [animation-delay:120ms]" />
      )}

      {page !== "register" ? (
        <ul className="space-y-3 motion-reduce:animate-none animate-auth-fade-up [animation-delay:220ms]">
          {FEATURES.map(({ icon: Icon, label, description }) => (
            <li
              key={label}
              className="flex items-start gap-3 rounded-xl border border-border/40 bg-card/40 px-3.5 py-3 backdrop-blur-sm transition-colors hover:border-primary/25 hover:bg-card/60"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-medium text-foreground">{label}</span>
                <span className="block text-xs text-muted-foreground">{description}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid grid-cols-2 gap-2 motion-reduce:animate-none animate-auth-fade-up [animation-delay:180ms]">
          {AUTH_ROLE_ORDER.map((role) => {
            const config = getAuthRole(role);
            const Icon = config.icon;
            const active = highlightRole === role;
            return (
              <div
                key={role}
                className={cn(
                  "rounded-xl border px-3 py-2.5 transition-all duration-300",
                  active ? config.surfaces.cardSelected : "border-border/40 bg-card/30 opacity-60"
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      active ? config.surfaces.segmentActive : "text-muted-foreground"
                    )}
                    aria-hidden
                  />
                  <span className="text-xs font-medium">{config.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
