"use client";

import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AuthCardLayout from "@/components/auth/AuthCardLayout";
import AuthRoleSelector from "@/components/auth/AuthRoleSelector";
import AuthField from "@/components/auth/AuthField";
import { AuthFooter, AuthFooterLink } from "@/components/auth/AuthFooter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { getAuthRole, type AuthRole } from "@/lib/authRoleConfig";
import { cn } from "@/lib/utils";

export default function Login() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthRole>("user");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const next = searchParams.get("next") || "/";
  const config = getAuthRole(mode);

  if (status === "loading") {
    return (
      <AuthCardLayout title="Sign in" size="wide" page="login" roleAccent="user">
        <div className="flex justify-center py-8">
          <Loader2 className="h-7 w-7 animate-spin text-primary/70" />
        </div>
      </AuthCardLayout>
    );
  }

  if (status === "authenticated") {
    navigate(next, { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password, {
        adminMode: mode === "admin",
      });
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCardLayout
      size="wide"
      page="login"
      roleAccent={mode}
      title="Sign in"
      subtitle="Enter your credentials to continue."
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
                Signing in…
              </>
            ) : mode === "admin" ? (
              "Sign in as admin"
            ) : (
              "Sign in as user"
            )}
          </Button>
        </form>

        <AuthFooter>
          <p>
            No account?{" "}
            <AuthFooterLink to="/register">Create account</AuthFooterLink>
          </p>
          <p>
            Scheduled for deletion?{" "}
            <Link
              to="/recover"
              className="font-medium text-primary hover:text-primary/80 hover:underline"
            >
              Recover account
            </Link>
          </p>
        </AuthFooter>
      </div>
    </AuthCardLayout>
  );
}
