"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  fetchMe,
  isAdminRole,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  type AuthUser,
  type UserRole,
} from "@/database/authStorage";
import {
  getAccessToken,
  getRefreshToken,
  SESSION_EXPIRED_EVENT,
} from "@/database/apiClient";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  login: (
    username: string,
    password: string,
    options?: { adminMode?: boolean }
  ) => Promise<void>;
  register: (
    username: string,
    password: string,
    role?: "user" | "admin"
  ) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const refreshProfile = useCallback(async () => {
    const me = await fetchMe();
    setUser(me);
    setStatus("authenticated");
  }, []);

  const bootstrap = useCallback(async () => {
    const hasToken = getAccessToken() || getRefreshToken();
    if (!hasToken) {
      setUser(null);
      setStatus("anonymous");
      return;
    }
    try {
      await refreshProfile();
    } catch {
      apiLogout();
      setUser(null);
      setStatus("anonymous");
    }
  }, [refreshProfile]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const login = useCallback(
    async (
      username: string,
      password: string,
      options?: { adminMode?: boolean }
    ) => {
      await apiLogin(username, password);
      const me = await fetchMe();
      if (options?.adminMode && !isAdminRole(me.role)) {
        apiLogout();
        setUser(null);
        setStatus("anonymous");
        throw new Error(
          "This account is not an administrator or superadmin. Use User sign in, or sign in with an admin account."
        );
      }
      setUser(me);
      setStatus("authenticated");
    },
    []
  );

  const register = useCallback(
    async (
      username: string,
      password: string,
      role: "user" | "admin" = "user"
    ) => {
      await apiRegister(username, password, role);
      if (getAccessToken()) {
        await refreshProfile();
      } else {
        await apiLogin(username, password);
        await refreshProfile();
      }
    },
    [refreshProfile]
  );

  const logout = useCallback(() => {
    apiLogout();
    setUser(null);
    setStatus("anonymous");
  }, []);

  useEffect(() => {
    const onExpired = () => logout();
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [logout]);

  const hasRole = useCallback(
    (...roles: UserRole[]) => {
      if (!user) return false;
      return roles.includes(user.role);
    },
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      status,
      login,
      register,
      logout,
      refreshProfile,
      hasRole,
    }),
    [user, status, login, register, logout, refreshProfile, hasRole]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
