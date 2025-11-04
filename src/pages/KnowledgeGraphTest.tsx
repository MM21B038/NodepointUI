"use client";

import React from "react";
import { BookOpenText } from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";

const KnowledgeGraphTest: React.FC = () => {
  const { currentWorkspace } = useWorkspace();

  return (
    <div className="h-full flex flex-col items-center justify-center p-4">
      <BookOpenText className="h-10 w-10 text-primary mb-4" />
      <h1 className="text-2xl font-bold">Knowledge Base Test Page</h1>
      <p className="text-muted-foreground mt-2">
        Current Workspace: {currentWorkspace || "None Selected"}
      </p>
      <p className="text-muted-foreground mt-2">
        If you see this, basic JSX parsing is working!
      </p>
    </div>
  );
};

export default KnowledgeGraphTest;