"use client";

import { getAuthRole, type AuthRole } from "@/lib/authRoleConfig";
import { cn } from "@/lib/utils";

export default function AuthBackground({
  className,
  role,
}: {
  className?: string;
  role?: AuthRole;
}) {
  const accent = role ? getAuthRole(role) : null;
  const isUser = role === "user";
  const isAdmin = role === "admin";

  return (
    <div
      className={cn("pointer-events-none fixed inset-0 overflow-hidden", className)}
      aria-hidden
    >
      <div className="absolute inset-0 bg-background" />

      <div
        className={cn(
          "absolute -left-[20%] -top-[25%] h-[70vmin] w-[70vmin] rounded-full blur-[100px] transition-colors duration-700",
          isUser && "bg-brand-workspace/[0.12] dark:bg-brand-workspace/[0.16]",
          isAdmin && "bg-brand-group/[0.1] dark:bg-brand-group/[0.14]",
          !role && "bg-primary/[0.07] dark:bg-primary/[0.12]"
        )}
      />
      <div
        className={cn(
          "absolute -right-[15%] top-[10%] h-[55vmin] w-[55vmin] rounded-full blur-[90px] transition-colors duration-700",
          isAdmin && "bg-brand-group/[0.12] dark:bg-brand-group/[0.16]",
          isUser && "bg-brand-chat/[0.08] dark:bg-brand-chat/[0.12]",
          !role && "bg-brand-group/[0.06] dark:bg-brand-group/[0.1]"
        )}
      />
      <div
        className={cn(
          "absolute -bottom-[20%] left-[25%] h-[60vmin] w-[60vmin] rounded-full blur-[110px] transition-colors duration-700",
          isUser && "bg-brand-workspace/[0.08] dark:bg-brand-workspace/[0.12]",
          isAdmin && "bg-primary/[0.08] dark:bg-primary/[0.12]",
          !role && "bg-brand-workspace/[0.05] dark:bg-brand-workspace/[0.09]"
        )}
      />

      <div
        className={cn(
          "absolute left-[12%] top-[18%] h-72 w-72 rounded-full blur-3xl motion-reduce:animate-none animate-auth-orb-a transition-colors duration-700",
          isUser && "bg-gradient-to-br from-brand-workspace/25 via-brand-workspace/5 to-transparent",
          isAdmin && "bg-gradient-to-br from-brand-group/25 via-brand-group/5 to-transparent",
          !role && "bg-gradient-to-br from-primary/20 via-primary/5 to-transparent"
        )}
      />
      <div
        className={cn(
          "absolute right-[8%] top-[32%] h-96 w-96 rounded-full blur-3xl motion-reduce:animate-none animate-auth-orb-b transition-colors duration-700",
          isAdmin && "bg-gradient-to-bl from-brand-group/20 via-transparent to-primary/10",
          isUser && "bg-gradient-to-bl from-brand-chat/15 via-transparent to-brand-workspace/10",
          !role && "bg-gradient-to-bl from-brand-group/15 via-transparent to-brand-chat/10"
        )}
      />
      <div
        className={cn(
          "absolute bottom-[12%] right-[28%] h-64 w-64 rounded-full blur-3xl motion-reduce:animate-none animate-auth-orb-c transition-colors duration-700",
          accent
            ? cn("bg-gradient-to-tr", accent.surfaces.glow)
            : "bg-gradient-to-tr from-brand-workspace/12 to-transparent"
        )}
      />

      <div
        className={cn(
          "absolute inset-x-0 top-1/3 h-[40vh] opacity-40 dark:opacity-25 motion-reduce:animate-none animate-auth-aurora transition-colors duration-700",
          isUser && "bg-gradient-to-r from-transparent via-brand-workspace/[0.1] to-transparent",
          isAdmin && "bg-gradient-to-r from-transparent via-brand-group/[0.1] to-transparent",
          !role && "bg-gradient-to-r from-transparent via-primary/[0.08] to-transparent"
        )}
      />

      <div
        className="absolute inset-0 opacity-[0.35] dark:opacity-[0.2]"
        style={{
          backgroundImage:
            "radial-gradient(circle, hsl(var(--foreground) / 0.12) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(ellipse 80% 70% at 50% 45%, black 20%, transparent 75%)",
        }}
      />

      <div className="absolute inset-0 auth-noise opacity-[0.025] dark:opacity-[0.04]" />

      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 80% at 50% 50%, transparent 40%, hsl(var(--background) / 0.85) 100%)",
        }}
      />
    </div>
  );
}
