"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AuthCardLayout from "@/components/auth/AuthCardLayout";
import AuthRoleSelector from "@/components/auth/AuthRoleSelector";
import AuthField from "@/components/auth/AuthField";
import { AuthFooter, AuthFooterLink } from "@/components/auth/AuthFooter";
import { Button } from "@/components/ui/button";
import { recoverAccount } from "@/database/authStorage";
import { useAuth } from "@/context/AuthContext";
import { getAuthRole, type AuthRole } from "@/lib/authRoleConfig";
import { cn } from "@/lib/utils";

export default function RecoverAccount() {
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthRole>("user");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const config = getAuthRole(mode);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await recoverAccount(
        username.trim(),
        password,
        mode === "admin" ? "admin" : "user"
      );
      await refreshProfile();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recovery failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCardLayout
      size="wide"
      page="recover"
      roleAccent={mode}
      title="Recover account"
      subtitle="Restore an account scheduled for deletion within the 30-day grace period."
    >
      <div className="space-y-4">
        <AuthRoleSelector variant="segment" value={mode} onChange={setMode} />

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <AuthField
            id="username"
            label="Username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            role={mode}
            required
            autoFocus
          />
          <AuthField
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            allowReveal
            role={mode}
            required
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
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Recovering…
              </>
            ) : (
              `Recover ${config.label.toLowerCase()} account`
            )}
          </Button>
        </form>
        <AuthFooter>
          <p>
            <AuthFooterLink to="/login">Back to sign in</AuthFooterLink>
          </p>
        </AuthFooter>
      </div>
    </AuthCardLayout>
  );
}
