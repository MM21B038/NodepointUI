"use client";

import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/database/authStorage";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";

interface RequireRoleProps {
  roles: UserRole[];
  children: React.ReactNode;
}

export default function RequireRole({ roles, children }: RequireRoleProps) {
  const { user, hasRole } = useAuth();

  if (!user || !hasRole(...roles)) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Alert className="max-w-md">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access denied</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>You do not have permission to view this page.</p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/">Back to home</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}
