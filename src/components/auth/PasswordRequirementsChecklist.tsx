"use client";

import { Check, Circle } from "lucide-react";
import {
  getPasswordPolicyChecks,
  isPasswordPolicySatisfied,
} from "@/lib/passwordPolicy";
import { getAuthRole, type AuthRole } from "@/lib/authRoleConfig";
import { cn } from "@/lib/utils";

interface PasswordRequirementsChecklistProps {
  password: string;
  className?: string;
  showWhenEmpty?: boolean;
  role?: AuthRole;
}

export default function PasswordRequirementsChecklist({
  password,
  className,
  showWhenEmpty = true,
  role,
}: PasswordRequirementsChecklistProps) {
  if (!showWhenEmpty && !password) return null;

  const rules = getPasswordPolicyChecks(password);
  const allMet = isPasswordPolicySatisfied(password);
  const accent = role ? getAuthRole(role).surfaces.banner : undefined;

  return (
    <div
      className={cn(
        "rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5",
        accent,
        className
      )}
      aria-live="polite"
    >
      <p className="text-xs font-medium text-muted-foreground mb-2">
        Password must include:
      </p>
      <ul className="space-y-1.5">
        {rules.map((rule) => (
          <li
            key={rule.id}
            className={cn(
              "flex items-start gap-2 text-xs transition-colors",
              rule.met
                ? "text-green-700 dark:text-green-500"
                : "text-muted-foreground"
            )}
          >
            {rule.met ? (
              <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
            ) : (
              <Circle className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-50" aria-hidden />
            )}
            <span>{rule.label}</span>
          </li>
        ))}
      </ul>
      {password.length > 0 && allMet ? (
        <p className="text-xs text-green-700 dark:text-green-500 mt-2 font-medium">
          Password meets all requirements
        </p>
      ) : null}
    </div>
  );
}
