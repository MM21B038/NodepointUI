"use client";

import React from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Loader2, X, BookOpenText } from "lucide-react";
import { Button } from "@/components/ui/button";

const KnowledgeGraphPage: React.FC = () => {
  const { currentWorkspace } = useWorkspace();

  // This is a temporary, minimal component to diagnose the parsing error.
  // If you see this message, it means the file is now parsing correctly.
  // We will restore the full functionality in the next step.
  if (!currentWorkspace) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-center">
          <h3 className="text-xl font-semibold">No Workspace Selected</h3>
          <p className="text-muted-foreground mt-2">
            Please select a workspace to view the Knowledge Graph.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full p-4">
      <div className="text-center">
        <BookOpenText className="h-10 w-10 mx-auto mb-4 text-primary" />
        <h3 className="text-xl font-semibold">Knowledge Graph Page</h3>
        <p className="text-muted-foreground mt-2">
          This is a temporary diagnostic page for workspace: <span className="font-medium">{currentWorkspace}</span>.
        </p>
        <p className="text-muted-foreground mt-1">
          If you see this, the parsing error is resolved. We'll restore the full graph next!
        </p>
      </div>
    </div>
  );
};

export default KnowledgeGraphPage;