"use client";

import { useAuth } from "@/context/AuthContext";
import {
  canTriggerWorkspacePreprocess,
  canViewGlobalPreprocessQueue,
  canViewPreprocessPipeline,
  canViewWorkspacePreprocessStatus,
  isAdminRole,
} from "@/database/authStorage";

export function useCanViewWorkspacePreprocess(): boolean {
  const { user } = useAuth();
  return canViewWorkspacePreprocessStatus(user?.role);
}

export function useCanTriggerWorkspacePreprocess(): boolean {
  const { user } = useAuth();
  return canTriggerWorkspacePreprocess(user?.role);
}

export function useCanViewGlobalPreprocessQueue(): boolean {
  const { user } = useAuth();
  return canViewGlobalPreprocessQueue(user?.role);
}

/** @deprecated Use useCanViewGlobalPreprocessQueue */
export function useCanViewPreprocessPipeline(): boolean {
  const { user } = useAuth();
  return canViewPreprocessPipeline(user?.role);
}

export function useIsAdminRole(): boolean {
  const { user } = useAuth();
  return isAdminRole(user?.role);
}
