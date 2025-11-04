"use client";

import React from "react";
import { useWorkspace } from "@/context/WorkspaceContext";

const KnowledgeGraphPage: React.FC = () => {
  const { currentWorkspace } = useWorkspace();

  return (
    <div className="p-4 text-center">
      <h1 className="text-2xl font-bold">Knowledge Base</h1>
      <p className="text-lg">Current Workspace: {currentWorkspace || "None Selected"}</p>
      <p className="mt-4 text-muted-foreground">This is a minimal test page.</p>
    </div>
  );
};

export default KnowledgeGraphPage;