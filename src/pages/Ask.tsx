"use client";

import React, { useState, useCallback } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";
import ChatInterface from "@/components/ChatInterface";
import SearchControls from "@/components/SearchControls";
import { performSearch, SearchEngineType, ProvenanceEntry } from "@/database/workspaceStorage";
import { toast } from "sonner";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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
      <div className="flex items-center justify-center h-full p-4 bg-background">
        <Alert className="max-w-lg shadow-lg">
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
    <div className="flex-grow h-full p-4 bg-gradient-to-br from-background to-muted/20">
      <ResizablePanelGroup
        direction="horizontal"
        className="min-h-[calc(100vh-120px)] rounded-xl border shadow-lg bg-card"
      >
        <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
          <Card className="h-full border-none shadow-none rounded-none">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold flex items-center">
                <Info className="h-5 w-5 mr-2 text-primary" />
                Search Settings
              </CardTitle>
              <Separator className="mt-2" />
            </CardHeader>
            <CardContent className="h-[calc(100%-80px)] overflow-y-auto">
              <SearchControls
                workspaceName={currentWorkspace}
                onSearchSettingsChange={handleSearchSettingsChange}
              />
            </CardContent>
          </Card>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={75}>
          <Card className="h-full border-none shadow-none rounded-none flex flex-col">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold flex items-center">
                <Info className="h-5 w-5 mr-2 text-primary" />
                Ask {currentWorkspace && `(${currentWorkspace})`}
              </CardTitle>
              <Separator className="mt-2" />
            </CardHeader>
            <CardContent className="flex-grow p-0 h-[calc(100%-80px)]">
              <ChatInterface
                onSendMessage={handleSendMessage}
                isLoadingSearch={isLoadingSearch}
                isWorkspaceSelected={!!currentWorkspace}
                className="h-full w-full border-none shadow-none rounded-none"
              />
            </CardContent>
          </Card>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default Ask;