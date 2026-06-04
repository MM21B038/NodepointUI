"use client";

import AuthNodeIllustration from "@/components/auth/AuthNodeIllustration";
import { getAuthRole, type AuthRole } from "@/lib/authRoleConfig";
import { cn } from "@/lib/utils";

type AuthPage = "login" | "register" | "recover";

const PAGE_EYEBROW: Record<AuthPage, string> = {
  login: "Sign in as",
  register: "Account type",
  recover: "Recover as",
};

const PAGE_BLURB: Record<AuthPage, (role: AuthRole) => string> = {
  login: (role) => getAuthRole(role).loginBlurb,
  register: (role) => getAuthRole(role).tagline,
  recover: () => "Use the same type you registered with during the grace period.",
};

export default function AuthRoleInsightCard({
  role,
  page,
  className,
}: {
  role: AuthRole;
  page: AuthPage;
  className?: string;
}) {
  const config = getAuthRole(role);
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm",
        config.surfaces.cardSelected,
        className
      )}
    >
      <div
        className={cn("h-0.5 shrink-0 bg-gradient-to-r", config.surfaces.glow)}
        aria-hidden
      />

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="relative flex justify-center py-2 sm:py-4">
          <div
            className={cn(
              "absolute inset-0 rounded-full blur-3xl transition-colors duration-500 motion-reduce:transition-none",
              "bg-gradient-to-br opacity-60",
              config.surfaces.glow
            )}
            aria-hidden
          />
          <AuthNodeIllustration key={role} role={role} className="relative" />
        </div>

        <div
          key={role}
          className="mt-2 flex flex-1 flex-col space-y-4 motion-reduce:animate-none animate-auth-fade-up"
        >
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              <span className={config.surfaces.segmentActive}>{PAGE_EYEBROW[page]}</span>
              {" · "}
              {config.label}
            </p>
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-300",
                  config.surfaces.iconWrapSelected
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 space-y-0.5">
                <p className="text-lg font-semibold tracking-tight text-foreground">
                  {config.headline}
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {PAGE_BLURB[page](role)}
                </p>
              </div>
            </div>
          </div>

          <ul className="space-y-2 border-t border-border/40 pt-4">
            {config.perks.map(({ icon: PerkIcon, text }) => (
              <li key={text} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors duration-300",
                    config.surfaces.perk
                  )}
                >
                  <PerkIcon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
