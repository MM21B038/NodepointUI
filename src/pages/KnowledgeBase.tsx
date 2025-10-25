"use client";

import React from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import KnowledgeGraph from "@/components/KnowledgeGraph";

const KnowledgeBase = () => {
  const { currentWorkspace } = useWorkspace();

  if (currentWorkspace) {
    console.log(`KnowledgeBase: Current workspace is set to: ${currentWorkspace}`);
  } else {
    console.log("KnowledgeBase: No current workspace selected.");
  }

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-semibold">Knowledge Base</h2>
      
      {currentWorkspace ? (
        <div className="space-y-4">
          <p className="text-lg text-muted-foreground">
            Exploring the knowledge graph for workspace: <span className="font-medium text-foreground">{currentWorkspace}</span>
          </p>
          <KnowledgeGraph workspaceName={currentWorkspace} />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-300px)] border rounded-lg p-8 bg-card">
          <h3 className="text-2xl font-semibold mb-2">No Workspace Selected</h3>
          <p className="text-muted-foreground">
            Please navigate to the Documents page and select or create a workspace to view its knowledge graph.
          </p>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;