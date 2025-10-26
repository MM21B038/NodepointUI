"use client";

import React from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import KnowledgeGraph from "@/components/KnowledgeGraph";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";

const KnowledgeBase: React.FC = () => {
  const { currentWorkspace } = useWorkspace();

  if (!currentWorkspace) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <Alert className="max-w-lg">
          <Info className="h-4 w-4" />
          <AlertTitle>No Workspace Selected</AlertTitle>
          <AlertDescription>
            Please select a workspace using the selector in the navigation bar to view the Knowledge Base.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4">
      <h1 className="text-3xl font-bold mb-4">Knowledge Base: {currentWorkspace}</h1>
      <div className="flex-grow min-h-0">
        <KnowledgeGraph workspaceName={currentWorkspace} />
      </div>
    </div>
  );
};

export default KnowledgeBase;