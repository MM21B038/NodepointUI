"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"; // Import useRef
import { MessageCircle, Info, Loader2, Sparkles, Globe, FolderSearch, Zap, FileText, Send, ChevronDown, ChevronUp, Bot } from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { listFiles, performStreamingSearch, SearchEngineType } from "@/database/workspaceStorage";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import FileFilterDialog from "@/components/FileFilterDialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import remarkGfm from 'remark-gfm';
import ProvenanceDisplay from "@/components/ProvenanceDisplay";

interface StreamProps {}

const Stream: React.FC<StreamProps> = () => {
  const { currentWorkspace } = useWorkspace();
  const [completedThinkingSteps, setCompletedThinkingSteps] = useState<any[]>([]); // Stores all completed steps
  const [currentActiveThinkingLog, setCurrentActiveThinkingLog] = useState<any | null>(null); // The currently active step
  const currentLlmChunkAccumulatorRef = useRef<string>(""); // Use useRef for accumulation
  const [finalAnswer, setFinalAnswer] = useState<any | null>(null);
  const [thinkingOpen, setThinkingOpen] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);

  const [currentInput, setCurrentInput] = useState("");
  const [selectedEngine, setSelectedEngine] = useState<string>("agent_search");
  const [isFileFilterDialogOpen, setIsFileFilterDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[] | "all">("all");
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);

  const searchEngineOptions = [
    { value: "agent_search", label: "Agent Search", icon: Sparkles },
    { value: "global_search", label: "Global Search", icon: Globe },
    { value: "local_search", label: "Local Search", icon: FolderSearch },
    { value: "hybrid_search", label: "Hybrid Search", icon: Zap },
  ];

  const currentEngine = searchEngineOptions.find(opt => opt.value === selectedEngine);
  const CurrentEngineIcon = currentEngine?.icon || Sparkles;
  const currentEngineLabel = currentEngine?.label || "Select Engine";

  const isInputAreaEnabled = useMemo(() => {
    return !!currentWorkspace && !isStreaming && !(Array.isArray(selectedFiles) && selectedFiles.length === 0);
  }, [currentWorkspace, isStreaming, selectedFiles]);

  const isSendButtonEnabled = useMemo(() => {
    return isInputAreaEnabled && currentInput.trim().length > 0;
  }, [isInputAreaEnabled, currentInput]);

  const fileSelectionError = useMemo(() => {
    return Array.isArray(selectedFiles) && selectedFiles.length === 0;
  }, [selectedFiles]);

  useEffect(() => {
    const fetchData = async () => {
      if (currentWorkspace) {
        try {
          const files = await listFiles(currentWorkspace);
          setAvailableFiles(files);
          if (Array.isArray(selectedFiles)) {
            const validSelectedFiles = selectedFiles.filter(file => files.includes(file));
            if (validSelectedFiles.length !== selectedFiles.length) {
              setSelectedFiles(validSelectedFiles.length === 0 ? "all" : validSelectedFiles);
            }
          }
        } catch (error) {
          console.error("Failed to fetch workspace files:", error);
        }
      } else {
        setAvailableFiles([]);
        setSelectedFiles("all");
        setCompletedThinkingSteps([]);
        setCurrentActiveThinkingLog(null);
        currentLlmChunkAccumulatorRef.current = ""; // Clear ref
        setFinalAnswer(null);
      }
    };
    fetchData();
    console.log("Stream: Current workspace changed or loaded. State reset.");
    console.log("Stream: Initial state - thinkingOpen:", thinkingOpen, "isStreaming:", isStreaming, "finalAnswer:", !!finalAnswer, "completedSteps:", completedThinkingSteps.length);
  }, [currentWorkspace, selectedFiles]);

  const finalizeCurrentThinkingLog = useCallback(() => {
    if (currentActiveThinkingLog) {
      if (currentActiveThinkingLog.step === "THINKING_LLM_CHUNKS") {
        if (currentLlmChunkAccumulatorRef.current) {
          setCompletedThinkingSteps(prev => [...prev, {
            ...currentActiveThinkingLog,
            data: { content: currentLlmChunkAccumulatorRef.current }, // Store accumulated content
            type: "final_llm_chunk" // Mark as finalized LLM chunk
          }]);
        }
      } else {
        setCompletedThinkingSteps(prev => [...prev, currentActiveThinkingLog]);
      }
    }
    setCurrentActiveThinkingLog(null);
    currentLlmChunkAccumulatorRef.current = ""; // Clear ref
  }, [currentActiveThinkingLog]);

  const handleStreamSend = useCallback(async () => {
    const query = currentInput.trim();
    if (!query || !currentWorkspace || !isSendButtonEnabled) return;

    setIsStreaming(true);
    setCompletedThinkingSteps([]);
    setCurrentActiveThinkingLog(null);
    currentLlmChunkAccumulatorRef.current = ""; // Clear ref
    setFinalAnswer(null);
    setThinkingOpen(true); // Open thinking panel when starting a new stream
    setCurrentInput("");

    try {
      const reader = await performStreamingSearch(
        currentWorkspace,
        selectedEngine as SearchEngineType,
        query,
        selectedFiles
      );
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;

          try {
            const event = JSON.parse(line.replace("data: ", ""));
            
            if (event.step.startsWith("THINKING")) {
              if (event.step === "THINKING_LLM_CHUNKS") { // Removed event.type === "token" check here
                let tokenContent = "";
                if (typeof event.data === 'string') {
                    tokenContent = event.data;
                } else if (event.content !== undefined) {
                    tokenContent = event.content;
                } else if (event.data && typeof event.data === 'object' && event.data.content !== undefined) {
                    tokenContent = event.data.content;
                }
                
                currentLlmChunkAccumulatorRef.current += tokenContent;
                
                // Always create a new object to ensure React detects the state change
                setCurrentActiveThinkingLog(prev => {
                  // Use previous event as base if it was also LLM_CHUNKS, otherwise use current event
                  const baseEvent = prev && prev.step === "THINKING_LLM_CHUNKS" ? prev : event; 
                  return {
                    ...baseEvent, // Spread the base event (either previous LLM_CHUNKS or current event)
                    step: "THINKING_LLM_CHUNKS", // Ensure step is correct
                    status: "progress", // Ensure status is correct
                    data: { content: currentLlmChunkAccumulatorRef.current } // Always use accumulated content
                  };
                });
              } else {
                // This is a new non-LLM chunk thinking step
                finalizeCurrentThinkingLog(); // Finalize previous step (could be LLM chunk or another thinking step)
                setCurrentActiveThinkingLog(event); // Set new event as active
              }
            }

            if (event.step === "FINAL_RESPONSE") {
              finalizeCurrentThinkingLog(); // Finalize any active thinking log before final response
              setFinalAnswer(event.data.message);
              setThinkingOpen(false); // auto close thinking panel
            }
          } catch (parseError) {
            console.error("Failed to parse SSE event:", parseError, "Raw line:", line);
          }
        }
      }
    } catch (error) {
      console.error("Streaming search failed:", error);
      finalizeCurrentThinkingLog(); // Finalize on error
      setFinalAnswer({ synthesis: { answer: `Error: ${error instanceof Error ? error.message : "An unknown error occurred during streaming."}` } });
      setThinkingOpen(false);
    } finally {
      setIsStreaming(false);
    }
  }, [currentInput, currentWorkspace, isSendButtonEnabled, selectedEngine, selectedFiles, finalizeCurrentThinkingLog]);

  const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleStreamSend();
    }
  };

  console.log("Stream render cycle: thinkingOpen", thinkingOpen, "isStreaming", isStreaming, "finalAnswer", !!finalAnswer, "completedSteps", completedThinkingSteps.length);

  const handleAccordionValueChange = useCallback((value: string) => {
    console.log("Accordion onValueChange triggered. New value:", value);
    setThinkingOpen(value === "thinking-panel");
  }, []);

  return (
    <div className="flex flex-col flex-grow h-full relative">
      {!currentWorkspace ? (
        <div className="flex-grow flex items-center justify-center">
          <Alert className="max-w-lg">
            <Info className="h-4 w-4" />
            <AlertTitle>No Workspace Selected</AlertTitle>
            <AlertDescription>
              Please select a workspace using the selector in the navigation bar to use the Stream feature.
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <div className="flex flex-col flex-grow mt-4 p-4 space-y-4 border-x-4 border-y-2 rounded-lg">
          <ScrollArea className="flex-grow h-0 w-full !transform-none hide-scrollbar p-4">
            {/* Thinking Dropdown */}
            <Accordion type="single" collapsible value={thinkingOpen ? "thinking-panel" : ""} onValueChange={handleAccordionValueChange}>
              <AccordionItem value="thinking-panel" className="border-none">
                <AccordionTrigger className="py-2 text-lg font-semibold text-primary hover:no-underline">
                  <span className="flex items-center">
                    <Bot className="h-5 w-5 mr-2" />
                    Thinking {thinkingOpen ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-0">
                  <div className="space-y-2 p-3 border rounded-lg bg-secondary/50 text-sm">
                    <p>DEBUG: thinkingOpen: {String(thinkingOpen)}</p>
                    <p>DEBUG: isStreaming: {String(isStreaming)}</p>
                    <p>DEBUG: finalAnswer: {String(!!finalAnswer)}</p>
                    <p>DEBUG: completedThinkingSteps.length: {completedThinkingSteps.length}</p>
                    {/* Case 1: Streaming and waiting for first log */}
                    {isStreaming && !currentActiveThinkingLog && (
                      <div className="flex items-center">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span>Waiting for first step...</span>
                      </div>
                    )}
                    {/* Case 2: Streaming and showing current log */}
                    {isStreaming && currentActiveThinkingLog && (
                      <div className="thinking-row space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-primary/80">{currentActiveThinkingLog.step.replace("THINKING_", "")}</span>
                          <span className="text-muted-foreground">— {currentActiveThinkingLog.status}</span>
                          <Loader2 className="h-3 w-3 animate-spin text-primary ml-auto" />
                        </div>
                        {currentActiveThinkingLog.data ? (
                          <pre className="bg-muted p-2 rounded-md text-xs overflow-x-auto">
                            <code>
                              {currentActiveThinkingLog.step === "THINKING_LLM_CHUNKS" && typeof currentActiveThinkingLog.data === 'object' && currentActiveThinkingLog.data.content !== undefined
                                ? currentActiveThinkingLog.data.content
                                : typeof currentActiveThinkingLog.data === 'string'
                                  ? currentActiveThinkingLog.data
                                  : JSON.stringify(currentActiveThinkingLog.data, null, 2)}
                            </code>
                          </pre>
                        ) : (
                          <p className="text-xs text-muted-foreground">No additional data for this step.</p>
                        )}
                      </div>
                    )}
                    {/* Case 3: Not streaming, final answer received, show all logs */}
                    {!isStreaming && finalAnswer && completedThinkingSteps.length > 0 && (
                      <Accordion type="multiple" className="w-full"> {/* Nested Accordion for individual logs */}
                        {completedThinkingSteps.map((log, i) => (
                          <AccordionItem key={i} value={`log-${i}`} className="border-b last:border-b-0">
                            <AccordionTrigger className="py-2 text-sm text-foreground hover:no-underline">
                              <div className="flex items-center gap-2 w-full">
                                <span className="font-medium text-primary/80">{log.step.replace("THINKING_", "")}</span>
                                <span className="text-muted-foreground">— {log.status}</span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pt-0 pb-2">
                              {log.data ? (
                                <pre className="bg-muted p-2 rounded-md text-xs overflow-x-auto">
                                  <code>
                                    {log.step === "THINKING_LLM_CHUNKS" && typeof log.data === 'object' && log.data.content !== undefined
                                      ? log.data.content
                                      : typeof log.data === 'string'
                                        ? log.data
                                        : JSON.stringify(log.data, null, 2)}
                                  </code>
                                </pre>
                              ) : (
                                <p className="text-xs text-muted-foreground">No additional data for this step.</p>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    )}
                    {/* Case 4: Idle state (not streaming, no final answer, no logs) */}
                    {!isStreaming && !finalAnswer && completedThinkingSteps.length === 0 && (
                      <p className="text-muted-foreground">Start a query to see thinking steps...</p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Final Answer */}
            {finalAnswer && (
              <div className="final-answer mt-6 p-4 border rounded-lg shadow-md bg-card">
                <h3 className="text-xl font-bold mb-3 flex items-center">
                  <MessageCircle className="h-5 w-5 mr-2 text-primary" /> Final Answer
                </h3>
                <div className="prose dark:prose-invert text-base">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {finalAnswer.synthesis.answer}
                  </ReactMarkdown>
                </div>
                {finalAnswer.synthesis.provenance && finalAnswer.synthesis.provenance.length > 0 && (
                  <ProvenanceDisplay provenance={finalAnswer.synthesis.provenance} />
                )}
              </div>
            )}
          </ScrollArea>

          <div className="flex flex-col gap-2 border rounded-lg px-3 py-2 bg-background shadow-sm flex-shrink-0">
            {fileSelectionError && currentWorkspace && (
              <Alert variant="destructive" className="w-full">
                <Info className="h-4 w-4" />
                <AlertTitle>File Selection Required</AlertTitle>
                <AlertDescription>
                  Please select at least one file to search.
                </AlertDescription>
              </Alert>
            )}
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" disabled={!isInputAreaEnabled} title={currentEngineLabel}>
                    <CurrentEngineIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  {searchEngineOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <DropdownMenuItem
                        key={option.value}
                        onClick={() => setSelectedEngine(option.value)}
                        className={cn("flex items-center", selectedEngine === option.value && "bg-accent text-accent-foreground")}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        <span>{option.label}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsFileFilterDialogOpen(true)}
                disabled={!isInputAreaEnabled || availableFiles.length === 0}
                title={Array.isArray(selectedFiles) && selectedFiles.length > 0 ? `${selectedFiles.length} file(s) selected` : "All files"}
              >
                <FileText className="h-4 w-4" />
              </Button>

              <div className="relative flex-grow flex flex-col border rounded-md p-2">
                <Textarea
                    placeholder={currentWorkspace ? "Type your message..." : "Select a workspace to chat"}
                    value={currentInput}
                    onChange={(e) => setCurrentInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="flex-grow min-h-[40px] resize-none border-none focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
                    disabled={!isInputAreaEnabled}
                    rows={1}
                />
                <Button
                    onClick={handleStreamSend}
                    disabled={!isSendButtonEnabled}
                    size="icon"
                    variant="ghost"
                    className="absolute bottom-2 right-2 h-8 w-8 text-primary hover:bg-primary/10"
                    title="Send message"
                >
                    {isStreaming ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Send className="h-4 w-4" />
                    )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <FileFilterDialog
        isOpen={isFileFilterDialogOpen}
        onClose={() => setIsFileFilterDialogOpen(false)}
        availableFiles={availableFiles}
        initialSelectedFiles={selectedFiles}
        onApplyFilter={setSelectedFiles}
      />
    </div>
  );
};

export default Stream;