"use client";

import React, { useState, useCallback } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";
import ChatInterface from "@/components/ChatInterface";
import { ProvenanceEntry } from "@/database/workspaceStorage";
import { sendChatMessage } from "@/database/chatStorage";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const Ask = () => {
  const { currentWorkspace } = useWorkspace();
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);

  const handleSendMessage = useCallback(
    async (query: string): Promise<{ answer: string; provenance: ProvenanceEntry[] }> => {
      if (!currentWorkspace) {
        toast.error("Please select a workspace before asking questions.");
        return { answer: "Error: No workspace selected.", provenance: [] };
      }

      setIsLoadingSearch(true);
      try {
        return await sendChatMessage(query, undefined, currentWorkspace);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "An unknown error occurred during chat.";
        toast.error(`Chat failed: ${errorMessage}`);
        return { answer: `Error: ${errorMessage}`, provenance: [] };
      } finally {
        setIsLoadingSearch(false);
      }
    },
    [currentWorkspace]
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
      <Card className="min-h-[calc(100vh-120px)] rounded-xl border shadow-lg bg-card flex flex-col">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-bold flex items-center">
            <Info className="h-5 w-5 mr-2 text-primary" />
            Ask ({currentWorkspace})
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
    </div>
  );
};

export default Ask;
