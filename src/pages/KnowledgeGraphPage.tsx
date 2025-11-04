"use client";

import React from "react";
import { BookOpenText, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/context/WorkspaceContext";

const KnowledgeGraphPage: React.FC = () => {
  const { currentWorkspace } = useWorkspace();

  // For now, we'll just show a basic message.
  // We'll add back the full logic, graph, filters, and detail panel incrementally.

  if (!currentWorkspace) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-center">
          <BookOpenText className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold">No Workspace Selected</h3>
          <p className="text-muted-foreground mt-2">
            Please select a workspace to view the Knowledge Base.
          </p>
        </div>
      </div>
    );
  }

  // Placeholder for loading state
  const isLoading = false; // Will be true when fetching data
  const error = null; // Will hold error message if any

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        <p className="text-lg text-muted-foreground">Loading Knowledge Graph...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <X className="h-10 w-10 text-destructive mb-4" />
        <h3 className="text-xl font-semibold text-destructive">Error Loading Graph</h3>
        <p className="text-muted-foreground mt-2">{error}</p>
        <Button className="mt-4">Try Refreshing</Button>
      </div>
    );
  }

  // Placeholder for when there's no graph data
  const graphDataExists = false; // Will be true if graphData is loaded and has nodes

  if (!graphDataExists) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <h3 className="text-xl font-semibold">No Knowledge Graph Data</h3>
        <p className="text-muted-foreground mt-2">
          No entities or relationships found for workspace "{currentWorkspace}". Ensure documents have been uploaded and processed.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4">
      <h1 className="text-3xl font-bold pb-4 flex items-center">
        <BookOpenText className="h-7 w-7 mr-3 text-primary" />
        Knowledge Base: {currentWorkspace}
      </h1>
      <div className="flex-grow flex items-center justify-center border rounded-lg bg-card">
        <p className="text-muted-foreground">
          This is the simplified Knowledge Graph page.
        </p>
      </div>
    </div>
  );
};

export default KnowledgeGraphPage;