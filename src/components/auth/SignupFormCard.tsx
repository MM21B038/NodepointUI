"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import AuthField from "@/components/auth/AuthField";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { allowAdminSignup } from "@/database/authStorage";
import PasswordRequirementsChecklist from "@/components/auth/PasswordRequirementsChecklist";
import { getAuthRole, type AuthRole } from "@/lib/authRoleConfig";
import {
  isPasswordPolicySatisfied,
  validatePasswordPolicy,
} from "@/lib/passwordPolicy";
import { cn } from "@/lib/utils";

interface SignupFormCardProps {
  role: AuthRole;
  onSuccess: () => void;
  className?: string;
}

export default function SignupFormCard({
  role,
  onSuccess,
  className,
}: SignupFormCardProps) {
  const { register } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const config = getAuthRole(role);
  const isAdmin = role === "admin";
  const adminSignupBlocked = isAdmin && !allowAdminSignup;
  const passwordValid = isPasswordPolicySatisfied(password);
  const confirmMatches =
    password.length > 0 && confirm.length > 0 && password === confirm;
  const readyToSubmit =
    !submitting && !adminSignupBlocked && passwordValid && confirmMatches;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    const policyError = validatePasswordPolicy(password);
    if (policyError) {
      setError(policyError);
      return;
    }
    setSubmitting(true);
    try {
      await register(username.trim(), password, role);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {adminSignupBlocked ? (
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
          Public admin registration may be disabled on the server. Ask an
          administrator to create your account or enable{" "}
          <code className="rounded bg-amber-500/10 px-1 text-[11px]">
            ALLOW_OPEN_ADMIN_SIGNUP
          </code>
          .
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <AuthField
          id={`${role}-username`}
          label="Username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          role={role}
          required
          autoFocus
        />
        <div className="space-y-2">
          <AuthField
            id={`${role}-password`}
            label="Password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            allowReveal
            role={role}
            required
          />
          <PasswordRequirementsChecklist password={password} role={role} />
        </div>
        <AuthField
          id={`${role}-confirm`}
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          allowReveal
          role={role}
          required
          hint={
            confirm.length > 0 && password !== confirm ? (
              <p className="text-xs text-destructive">Passwords do not match</p>
            ) : confirmMatches ? (
              <p className="flex items-center gap-1 text-xs text-green-700 dark:text-green-500">
                <Check className="h-3.5 w-3.5" aria-hidden />
                Passwords match
              </p>
            ) : null
          }
        />

        {error ? (
          <div
            className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <Button
          type="submit"
          className={cn("h-10 w-full", config.surfaces.button)}
          disabled={!readyToSubmit}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account…
            </>
          ) : (
            `Create ${config.label.toLowerCase()} account`
          )}
        </Button>
      </form>
    </div>
  );
}
