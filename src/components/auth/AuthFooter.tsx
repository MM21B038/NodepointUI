"use client";

import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthFooterLinkProps {
  to: string;
  children: React.ReactNode;
  className?: string;
}

export function AuthFooterLink({ to, children, className }: AuthFooterLinkProps) {
  return (
    <Link
      to={to}
      className={cn(
        "group inline-flex items-center gap-1 font-medium text-primary transition-colors hover:text-primary/80",
        className
      )}
    >
      {children}
      <ArrowRight
        className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}

export function AuthFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "mt-4 space-y-2 border-t border-border/50 pt-4 text-center text-sm text-muted-foreground",
        className
      )}
    >
      {children}
    </div>
  );
}
