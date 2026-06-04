"use client";

import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export function useLogout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  return useCallback(() => {
    const name = user?.username;
    logout();
    toast.success(name ? `Signed out (${name})` : "Signed out");
    navigate("/login", { replace: true });
  }, [logout, navigate, user?.username]);
}
