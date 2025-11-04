"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getKnowledgeGraph, KnowledgeGraphResponse, GraphNode, GraphEdge } from "@/database/workspaceStorage";
import { Loader2, X, Info, ChevronLeft, ChevronRight, BookOpenText } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import DetailPanel from "../components/DetailPanel";
import { 
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useWorkspace } from "@/context/WorkspaceContext";
import GraphView from "@/components/GraphView";

const KnowledgeGraphPage: React.FC = () => {
  const { currentWorkspace } = useWorkspace();
  
  const [graphData, setGraphData] = useState<KnowledgeGraphResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<GraphNode | GraphEdge | null>(null);
  
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(true);

  const fetchData = useCallback(async () => {
    if (!currentWorkspace) {
      setIsLoading(false);
      setGraphData(null);
      setError("No workspace selected.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSelectedItem(null);
    try {
      const data = await getKnowledgeGraph(currentWorkspace);
      setGraphData(data);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to load knowledge graph.";
      setError(errorMessage);
      toast.error(errorMessage);
      setGraphData(null);
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (selectedItem && !isDetailPanelOpen) {
      setIsDetailPanelOpen(true);
    }
  }, [selectedItem, isDetailPanelOpen]);

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
        <Button onClick={fetchData} className="mt-4">Try Refreshing</Button>
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <h3 className="text-xl font-semibold">No Knowledge Graph Data</h3>
        <p className="text-muted-foreground mt-2">
          No entities or relationships found for workspace "{currentWorkspace}". Ensure documents have been uploaded and processed.
        </p>
      </div>
    );
  }

  // Simplified return statement to test the parser
  return (
    <div className="h-full flex flex-col p-4">
      <h1 className="text-2xl font-bold mb-4">Knowledge Graph Page (Simplified)</h1>
      <p className="text-muted-foreground">If you see this, the parser is working! We can then gradually reintroduce the full component structure.</p>
    </div>
  );
};

export default KnowledgeGraphPage;