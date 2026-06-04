"use client";

import React from "react";
import { Link } from "react-router-dom";
import AuthBackground from "@/components/auth/AuthBackground";
import AuthRoleInsightCard from "@/components/auth/AuthRoleInsightCard";
import { NodepointLogo } from "@/components/brand/NodepointLogo";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { getAuthRole, type AuthRole } from "@/lib/authRoleConfig";
import { cn } from "@/lib/utils";

type AuthPage = "login" | "register" | "recover";

const PAGE_EYEBROW: Record<AuthPage, string> = {
  login: "Welcome back",
  register: "Get started",
  recover: "Account recovery",
};

function AuthFormCard({
  accent,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  accent: ReturnType<typeof getAuthRole> | null;
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm",
        accent?.surfaces.cardSelected
      )}
    >
      {accent ? (
        <div
          className={cn("h-0.5 shrink-0 bg-gradient-to-r", accent.surfaces.glow)}
          aria-hidden
        />
      ) : null}

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="mb-5 space-y-1">
          <p
            className={cn(
              "text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground",
              accent?.surfaces.segmentActive
            )}
          >
            {eyebrow}
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>

        {children}
      </div>
    </div>
  );
}

export default function AuthCardLayout({
  children,
  title,
  subtitle,
  size = "default",
  roleAccent = "user",
  page = "login",
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  /** @deprecated use size="wide" */
  wide?: boolean;
  /** @deprecated no nested inner card */
  plainBody?: boolean;
  /** @deprecated brand panel removed */
  hideBrand?: boolean;
  roleAccent?: AuthRole;
  page?: AuthPage;
  size?: "default" | "wide";
}) {
  const accent = getAuthRole(roleAccent);
  const splitLayout = size === "wide";

  return (
    <div className="relative flex min-h-dvh flex-col">
      <AuthBackground role={roleAccent} />

      <div className="relative flex min-h-dvh flex-col bg-muted/25">
        <header className="flex shrink-0 items-center justify-between px-4 py-3 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg px-1 py-1 font-semibold text-foreground transition-colors hover:text-primary"
          >
            <NodepointLogo size={26} />
            <span className="hidden sm:inline">Nodepoint</span>
          </Link>
          <ThemeSwitcher />
        </header>

        <main className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          <div
            className={cn(
              "w-full",
              splitLayout
                ? "max-w-5xl lg:grid lg:grid-cols-2 lg:items-stretch lg:gap-6 xl:gap-8"
                : "max-w-[400px]"
            )}
          >
            {splitLayout ? (
              <AuthRoleInsightCard
                role={roleAccent}
                page={page}
                className="mb-6 hidden lg:flex lg:mb-0"
              />
            ) : null}

            <AuthFormCard
              accent={accent}
              eyebrow={PAGE_EYEBROW[page]}
              title={title}
              subtitle={subtitle}
            >
              {children}
            </AuthFormCard>
          </div>
        </main>
      </div>
    </div>
  );
}
