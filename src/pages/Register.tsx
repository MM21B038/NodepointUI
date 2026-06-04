"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AuthCardLayout from "@/components/auth/AuthCardLayout";
import AuthRoleSelector from "@/components/auth/AuthRoleSelector";
import SignupFormCard from "@/components/auth/SignupFormCard";
import { AuthFooter, AuthFooterLink } from "@/components/auth/AuthFooter";
import { useAuth } from "@/context/AuthContext";
import { allowAdminSignup } from "@/database/authStorage";
import { type AuthRole } from "@/lib/authRoleConfig";

export default function Register() {
  const { status } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<AuthRole>("user");

  if (status === "loading") {
    return (
      <AuthCardLayout
        title="Create account"
        size="wide"
        page="register"
        roleAccent="user"
      >
        <div className="flex justify-center py-8">
          <Loader2 className="h-7 w-7 animate-spin text-primary/70" />
        </div>
      </AuthCardLayout>
    );
  }

  if (status === "authenticated") {
    navigate("/", { replace: true });
    return null;
  }

  const handleSuccess = () => {
    navigate("/", { replace: true });
  };

  return (
    <AuthCardLayout
      size="wide"
      page="register"
      roleAccent={role}
      title="Create account"
      subtitle="Choose your account type, then set a username and password."
    >
      <div className="space-y-4">
        <AuthRoleSelector
          variant="segment"
          value={role}
          onChange={setRole}
          adminSignupBlocked={!allowAdminSignup}
        />
        <SignupFormCard key={role} role={role} onSuccess={handleSuccess} />
        <AuthFooter className="mt-4 pt-4">
          <p>
            Already have an account?{" "}
            <AuthFooterLink to="/login">Sign in</AuthFooterLink>
          </p>
        </AuthFooter>
      </div>
    </AuthCardLayout>
  );
}
