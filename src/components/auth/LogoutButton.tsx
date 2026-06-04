"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLogout } from "@/hooks/useLogout";
import { cn } from "@/lib/utils";

interface LogoutButtonProps {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
  showLabel?: boolean;
  className?: string;
}

export default function LogoutButton({
  variant = "ghost",
  size = "sm",
  showLabel = true,
  className,
}: LogoutButtonProps) {
  const signOut = useLogout();

  if (size === "icon") {
    return (
      <Button
        type="button"
        variant={variant}
        size="icon"
        className={cn("text-muted-foreground hover:text-destructive", className)}
        onClick={signOut}
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(
        showLabel && "text-muted-foreground hover:text-destructive",
        className
      )}
      onClick={signOut}
    >
      <LogOut className="h-4 w-4" />
      {showLabel ? <span className="ml-2">Log out</span> : null}
    </Button>
  );
}
