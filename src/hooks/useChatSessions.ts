"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ViewScopeMode } from "@/lib/viewScope";
import type { OwnerParams } from "@/lib/ownerScope";
import {
  createChatSession,
  deleteChatSession,
  getStoredActiveSessionId,
  getStoredIncognito,
  listChatSessions,
  renameChatSession,
  resolveChatKey,
  setStoredActiveSessionId,
  setStoredIncognito,
  sessionDisplayTitle,
  type ChatSessionMeta,
} from "@/database/chatStorage";

export interface UseChatSessionsArgs {
  scopeMode: ViewScopeMode;
  workspaceName: string | null;
  groupName: string | null;
  owner?: OwnerParams;
  enabled: boolean;
}

export interface UseChatSessionsResult {
  chatKey: string | null;
  sessions: ChatSessionMeta[];
  activeSessionId: string | null;
  activeSessionTitle: string;
  incognito: boolean;
  loading: boolean;
  error: string | null;
  setIncognito: (value: boolean) => void;
  selectSession: (sessionId: string) => void;
  createSession: (title?: string) => Promise<string>;
  renameSession: (sessionId: string, title: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<string | void>;
  refreshSessions: () => Promise<ChatSessionMeta[] | void>;
  ensureSessionReady: () => Promise<{
    chatKey: string;
    sessionId: string | null;
    incognito: boolean;
  }>;
}

export function useChatSessions({
  scopeMode,
  workspaceName,
  groupName,
  owner,
  enabled,
}: UseChatSessionsArgs): UseChatSessionsResult {
  const [chatKey, setChatKey] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [incognito, setIncognitoState] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadGenRef = useRef(0);

  const activeSessionTitle = (() => {
    if (incognito) return "Incognito";
    const match = sessions.find((s) => s.session_id === activeSessionId);
    return sessionDisplayTitle(match?.title);
  })();

  const refreshSessions = useCallback(async (): Promise<ChatSessionMeta[] | void> => {
    if (!enabled) return;
    const list = await listChatSessions(
      scopeMode,
      workspaceName,
      groupName,
      owner
    );
    setSessions(list);
    return list;
  }, [enabled, scopeMode, workspaceName, groupName, owner]);

  const setIncognito = useCallback(
    (value: boolean) => {
      setIncognitoState(value);
      if (chatKey) setStoredIncognito(chatKey, value);
    },
    [chatKey]
  );

  const selectSession = useCallback(
    (sessionId: string) => {
      setActiveSessionId(sessionId);
      setIncognitoState(false);
      if (chatKey) {
        setStoredActiveSessionId(chatKey, sessionId);
        setStoredIncognito(chatKey, false);
      }
    },
    [chatKey]
  );

  const createSession = useCallback(
    async (title?: string) => {
      const created = await createChatSession(
        scopeMode,
        workspaceName,
        groupName,
        title ? { title } : undefined,
        owner
      );
      await refreshSessions();
      selectSession(created.session_id);
      return created.session_id;
    },
    [
      scopeMode,
      workspaceName,
      groupName,
      owner,
      refreshSessions,
      selectSession,
    ]
  );

  const renameSession = useCallback(
    async (sessionId: string, title: string) => {
      await renameChatSession(
        scopeMode,
        workspaceName,
        groupName,
        sessionId,
        title,
        owner
      );
      await refreshSessions();
    },
    [scopeMode, workspaceName, groupName, owner, refreshSessions]
  );

  const deleteSession = useCallback(
    async (sessionId: string): Promise<string | void> => {
      await deleteChatSession(
        scopeMode,
        workspaceName,
        groupName,
        sessionId,
        owner
      );
      const list = await refreshSessions();
      if (activeSessionId === sessionId) {
        if (list && list.length > 0) {
          selectSession(list[0].session_id);
        } else {
          return createSession();
        }
      }
    },
    [
      scopeMode,
      workspaceName,
      groupName,
      owner,
      activeSessionId,
      refreshSessions,
      selectSession,
      createSession,
    ]
  );

  const ensureSessionReady = useCallback(async () => {
    const key = resolveChatKey(scopeMode, workspaceName, groupName);
    const incog = getStoredIncognito(key);
    if (incog) {
      setIncognitoState(true);
      setActiveSessionId(null);
      return { chatKey: key, sessionId: null, incognito: true };
    }
    let list = await listChatSessions(scopeMode, workspaceName, groupName, owner);
    let sessionId = getStoredActiveSessionId(key);
    if (!sessionId || !list.some((s) => s.session_id === sessionId)) {
      if (list.length > 0) {
        sessionId = list[0].session_id;
      } else {
        const created = await createChatSession(
          scopeMode,
          workspaceName,
          groupName,
          undefined,
          owner
        );
        sessionId = created.session_id;
        list = await listChatSessions(scopeMode, workspaceName, groupName, owner);
      }
      setStoredActiveSessionId(key, sessionId);
    }
    setActiveSessionId(sessionId);
    setIncognitoState(false);
    setSessions(list);
    return { chatKey: key, sessionId, incognito: false };
  }, [scopeMode, workspaceName, groupName, owner]);

  useEffect(() => {
    if (!enabled) {
      setChatKey(null);
      setSessions([]);
      setActiveSessionId(null);
      setIncognitoState(false);
      setLoading(false);
      setError(null);
      return;
    }

    const gen = ++loadGenRef.current;
    setLoading(true);
    setError(null);
    setSessions([]);
    setActiveSessionId(null);

    void (async () => {
      try {
        const key = resolveChatKey(scopeMode, workspaceName, groupName);
        if (gen !== loadGenRef.current) return;
        setChatKey(key);

        const storedIncog = getStoredIncognito(key);
        if (storedIncog) {
          setIncognitoState(true);
          setActiveSessionId(null);
          setSessions(
            await listChatSessions(scopeMode, workspaceName, groupName, owner)
          );
          return;
        }

        let list = await listChatSessions(scopeMode, workspaceName, groupName, owner);
        if (gen !== loadGenRef.current) return;

        let sessionId = getStoredActiveSessionId(key);
        if (!sessionId || !list.some((s) => s.session_id === sessionId)) {
          if (list.length > 0) {
            sessionId = list[0].session_id;
          } else {
            const created = await createChatSession(
              scopeMode,
              workspaceName,
              groupName,
              undefined,
              owner
            );
            sessionId = created.session_id;
            list = await listChatSessions(
              scopeMode,
              workspaceName,
              groupName,
              owner
            );
          }
          setStoredActiveSessionId(key, sessionId);
        }

        setSessions(list);
        setActiveSessionId(sessionId);
        setIncognitoState(false);
      } catch (err) {
        if (gen !== loadGenRef.current) return;
        setError(err instanceof Error ? err.message : "Failed to load sessions");
        setChatKey(null);
      } finally {
        if (gen === loadGenRef.current) setLoading(false);
      }
    })();
  }, [enabled, scopeMode, workspaceName, groupName, owner]);

  return {
    chatKey,
    sessions,
    activeSessionId,
    activeSessionTitle,
    incognito,
    loading,
    error,
    setIncognito,
    selectSession,
    createSession,
    renameSession,
    deleteSession,
    refreshSessions,
    ensureSessionReady,
  };
}
