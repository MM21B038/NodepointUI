"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthRole, type AuthRole } from "@/lib/authRoleConfig";
import { cn } from "@/lib/utils";

interface AuthFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
  allowReveal?: boolean;
  hint?: React.ReactNode;
  error?: string | null;
  role?: AuthRole;
}

const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(
  ({ label, id, allowReveal, hint, error, role, className, type, ...props }, ref) => {
    const [revealed, setRevealed] = useState(false);
    const isPassword = type === "password";
    const inputType = isPassword && allowReveal && revealed ? "text" : type;
    const focusClass = role ? getAuthRole(role).surfaces.fieldFocus : "focus-visible:border-primary/40 focus-visible:ring-primary/20";

    return (
      <div className="space-y-2">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <div className="relative">
          <Input
            ref={ref}
            id={id}
            type={inputType}
            className={cn(
              "h-11 border-border/60 bg-background/80 transition-shadow focus-visible:ring-2 focus-visible:ring-offset-0",
              focusClass,
              allowReveal && isPassword && "pr-11",
              error && "border-destructive/60 focus-visible:ring-destructive/20",
              className
            )}
            aria-invalid={error ? true : undefined}
            {...props}
          />
          {allowReveal && isPassword ? (
            <button
              type="button"
              className={cn(
                "absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center",
                "rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              )}
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? "Hide password" : "Show password"}
            >
              {revealed ? (
                <EyeOff className="h-4 w-4" aria-hidden />
              ) : (
                <Eye className="h-4 w-4" aria-hidden />
              )}
            </button>
          ) : null}
        </div>
        {hint}
        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }
);

AuthField.displayName = "AuthField";

export default AuthField;
