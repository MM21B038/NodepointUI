"use client";

import { getAuthRole, type AuthRole } from "@/lib/authRoleConfig";
import { cn } from "@/lib/utils";

interface AuthRoleBannerProps {
  role: AuthRole;
  action: "signup" | "signin" | "recover";
  className?: string;
}

const ACTION_LABEL: Record<AuthRoleBannerProps["action"], string> = {
  signup: "Creating",
  signin: "Signing in as",
  recover: "Recovering",
};

export default function AuthRoleBanner({
  role,
  action,
  className,
}: AuthRoleBannerProps) {
  const config = getAuthRole(role);
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3.5",
        "motion-reduce:animate-none animate-auth-fade-up",
        config.surfaces.banner,
        className
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          config.surfaces.iconWrapSelected
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {ACTION_LABEL[action]} · {config.label}
        </p>
        <p className="text-sm font-semibold text-foreground">{config.headline}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {action === "signup" ? config.signupBlurb : config.loginBlurb}
        </p>
      </div>
    </div>
  );
}
