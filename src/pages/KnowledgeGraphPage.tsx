"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getKnowledgeGraph, KnowledgeGraphResponse, GraphNode, GraphEdge } from "@/database/workspaceStorage";
import { Loader2, X, Info, ChevronLeft, ChevronRight, BookOpenText } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DetailPanel } from "../components/InteractiveGraphVisualization";
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
    console.log("Fetching knowledge graph for workspace:", currentWorkspace);
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
      console.log("Knowledge graph data received:", data);
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

  return (
    <div className="h-full flex flex-col">
      <h1 className="text-3xl font-bold p-4 pb-0 flex items-center">
        <BookOpenText className="h-7 w-7 mr-3 text-primary" />
        Knowledge Base: {currentWorkspace}
      </h1>
      <div className="flex-grow min-h-0 px-4 pb-4">
        <ResizablePanelGroup
          direction="horizontal"
          className="min-h-[calc(100vh-120px)] rounded-xl border shadow-lg bg-card"
        >
          <ResizablePanel defaultSize={75} minSize={50}>
            <GraphView
              graphData={graphData}
              isLoading={isLoading}
              fetchData={fetchData}
              selectedItem={selectedItem}
              onSelect={setSelectedItem}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel 
            defaultSize={25} 
            minSize={15} 
            collapsed={!isDetailPanelOpen} 
            onCollapse={(collapsed) => setIsDetailPanelOpen(!isDetailPanelOpen)}
            className="transition-all duration-300 ease-in-out"
          >
            <Card className="h-full border-none shadow-none rounded-none flex flex-col">
              <CardHeader className="pb-2 px-4 pt-4 flex flex-row items-center justify-between">
                {isDetailPanelOpen && <CardTitle className="text-lg font-semibold">Details</CardTitle>}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsDetailPanelOpen(!isDetailPanelOpen)}
                  className={cn("ml-auto", !isDetailPanelOpen && "mx-auto")}
                >
                  {isDetailPanelOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4"} />}
                </Button>
              </CardHeader>
              {isDetailPanelOpen && (
                <CardContent className="flex-grow p-0 h-[calc(100%-60px)]">
                  <ScrollArea className="h-full">
                    <DetailPanel item={selectedItem} />
                  </ScrollArea>
                </CardContent>
              )}
            </Card>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default KnowledgeGraphPage;
// Added a comment to force re-evaluation.