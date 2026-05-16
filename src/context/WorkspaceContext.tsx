"use client";

import React, { createContext, useState, useContext, useCallback } from "react";

interface WorkspaceContextType {
  currentWorkspace: string | null;
  setCurrentWorkspace: (name: string | null) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
};

interface WorkspaceProviderProps {
  children: React.ReactNode;
}

export const WorkspaceProvider: React.FC<WorkspaceProviderProps> = ({ children }) => {
  const [currentWorkspace, setCurrentWorkspaceState] = useState<string | null>(null);

  // Use useCallback to ensure stability
  const setCurrentWorkspace = useCallback((name: string | null) => {
    setCurrentWorkspaceState(name);
  }, []);

  return (
    <WorkspaceContext.Provider value={{ currentWorkspace, setCurrentWorkspace }}>
      {children}
    </WorkspaceContext.Provider>
  );
};