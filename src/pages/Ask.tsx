"use client";

import React, { useState, useCallback } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";
import ChatInterface from "@/components/ChatInterface";
import SearchControls from "@/components/SearchControls";
import { performSearch, SearchEngineType, ProvenanceEntry } from "@/database/workspaceStorage";
import { toast } from "sonner";

const Ask = () => {
  const { currentWorkspace } = useWorkspace();
  const [selectedEngine, setSelectedEngine] = useState<SearchEngineType>("agent_search");
  const [selectedFiles, setSelectedFiles] = useState<string[] | "all">("all");
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);

  const handleSearchSettingsChange = useCallback(
    (engine: SearchEngineType, files: string[] | "all") => {
      setSelectedEngine(engine);
      setSelectedFiles(files);
    },
    []
  );

  const handleSendMessage = useCallback(
    async (query: string): Promise<{ answer: string; provenance: ProvenanceEntry[] }> => {
      if (!currentWorkspace) {
        toast.error("Please select a workspace before asking questions.");
        return { answer: "Error: No workspace selected.", provenance: [] };
      }

      setIsLoadingSearch(true);
      try {
        const response = await performSearch(
          currentWorkspace,
          selectedEngine,
          query,
          selectedFiles
        );
        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during search.";
        toast.error(`Search failed: ${errorMessage}`);
        return { answer: `Error: ${errorMessage}`, provenance: [] };
      } finally {
        setIsLoadingSearch(false);
      }
    },
    [currentWorkspace, selectedEngine, selectedFiles]
  );

  if (!currentWorkspace) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <Alert className="max-w-lg">
          <Info className="h-4 w-4" />
          <AlertTitle>No Workspace Selected</AlertTitle>
          <AlertDescription>
            Please select a workspace using the selector in the navigation bar to use the Ask feature.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <SearchControls
        workspaceName={currentWorkspace}
        onSearchSettingsChange={handleSearchSettingsChange}
      />
      <div className="flex-grow flex flex-col h-full p-4"> {/* Added h-full and p-4 here */}
        <h2 className="text-3xl font-semibold mb-4"> {/* Removed px-4 pt-4 from h2 */}
          Ask {currentWorkspace && `(${currentWorkspace})`}
        </h2>
        <ChatInterface
          onSendMessage={handleSendMessage}
          isLoadingSearch={isLoadingSearch}
          isWorkspaceSelected={!!currentWorkspace}
          className="flex-grow h-full" {/* Removed px-4 pb-4 from here */}
        />
      </div>
    </div>
  );
};

export default Ask;