"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { MessageCircle, Info, Loader2, Sparkles, Globe, FolderSearch, Zap, FileText, Send, ChevronDown, ChevronUp, Bot, User } from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { listFiles, performStreamingSearch, SearchEngineType, getChatHistory } from "@/database/workspaceStorage";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { iconComponents } from "@/lib/icons";

export interface ChatMessage {
  id: string;
  type: "user" | "bot";
  text: string;
  timestamp: Date;
  provenance?: any[]; // Can be ProvenanceEntry[] or other structure
  thinkingSteps?: any[]; // New: stores thinking steps for this specific bot message
}

const Stream: React.FC = () => {
  const { currentWorkspace } = useWorkspace();
  const [chatHistoryMessages, setChatHistoryMessages] = useState<ChatMessage[]>([]); // All completed messages (historical + finalized current)

  // States for the *currently active* streaming query
  const [currentStreamingThinkingSteps, setCurrentStreamingThinkingSteps] = useState<any[]>([]);
  const currentLlmChunkAccumulatorRef = useRef<string>(""); // Accumulates LLM chunks for the current stream
  const [currentStreamingAnswerChunk, setCurrentStreamingAnswerChunk] = useState<string>(""); // Live answer chunk
  const [currentStreamingProvenance, setCurrentStreamingProvenance] = useState<any[]>([]); // Live provenance
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [thinkingPanelOpen, setThinkingPanelOpen] = useState(false); // Controls visibility of the thinking accordion for the *current* query.

  const [currentInput, setCurrentInput] = useState("");
  const [selectedEngine, setSelectedEngine] = useState<string>("agent_search");
  const [isFileFilterDialogOpen, setIsFileFilterDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[] | "all">("all");
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null); // Ref for auto-scrolling
  const [botIconComponent, setBotIconComponent] = useState<React.FC<React.SVGProps<SVGSVGElement>>>(Bot);
  const [userIconComponent, setUserIconComponent] = useState<React.FC<React.SVGProps<SVGSVGElement>>>(User);

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
    const loadIcons = () => {
      const savedBotIconName = localStorage.getItem("chatBotIcon");
      const savedUserIconName = localStorage.getItem("chatUserIcon");

      if (savedBotIconName && iconComponents[savedBotIconName]) {
        setBotIconComponent(() => iconComponents[savedBotIconName]);
      } else {
        setBotIconComponent(() => Bot);
      }

      if (savedUserIconName && iconComponents[savedUserIconName]) {
        setUserIconComponent(() => iconComponents[savedUserIconName]);
      } else {
        setUserIconComponent(() => User);
      }
    };

    loadIcons();
    window.addEventListener('chatIconsUpdated', loadIcons);

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

        // Fetch chat history
        try {
          const history = await getChatHistory(currentWorkspace);
          const mappedMessages: ChatMessage[] = history.flatMap(entry => {
            const messages: ChatMessage[] = [];
            messages.push({
              id: `user-${entry.request_time}`,
              type: "user",
              text: entry.query,
              timestamp: new Date(entry.request_time),
            });

            let provenance: any[] = [];
            if (Array.isArray(entry.source)) {
              provenance = entry.source.filter((item: any) =>
                typeof item === 'object' && item !== null &&
                'id' in item && 'reason' in item && 'snippet' in item
              );
            } else if (typeof entry.source === 'string') {
              const trimmedSource = entry.source.trim();
              try {
                const parsedSource = JSON.parse(trimmedSource);
                if (Array.isArray(parsedSource)) {
                  provenance = parsedSource.filter((item: any) =>
                    typeof item === 'object' && item !== null &&
                    'id' in item && 'reason' in item && 'snippet' in item
                  );
                } else if (typeof parsedSource === 'object' && parsedSource !== null && 'id' in parsedSource && 'reason' in parsedSource && 'snippet' in parsedSource) {
                  provenance = [parsedSource];
                }
              } catch (e) {
                provenance = [{ id: "direct-source", reason: "Direct string source", snippet: trimmedSource }];
              }
            }

            messages.push({
              id: `bot-${entry.response_time}`,
              type: "bot",
              text: entry.ai,
              timestamp: new Date(entry.response_time),
              provenance: provenance,
            });
            return messages;
          }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
          setChatHistoryMessages(mappedMessages);
        } catch (error) {
          console.error("Failed to fetch chat history:", error);
          setChatHistoryMessages([]);
        }

      } else {
        setAvailableFiles([]);
        setSelectedFiles("all");
        setChatHistoryMessages([]);
        setCurrentStreamingThinkingSteps([]);
        currentLlmChunkAccumulatorRef.current = "";
        setCurrentStreamingAnswerChunk("");
        setCurrentStreamingProvenance([]);
        setThinkingPanelOpen(false);
      }
    };
    fetchData();

    return () => {
      window.removeEventListener('chatIconsUpdated', loadIcons);
    };
  }, [currentWorkspace, selectedFiles]);

  // Effect for auto-scrolling
  useEffect(() => {
    if (messagesEndRef.current) {
      const viewport = messagesEndRef.current.closest('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: "smooth",
        });
      }
    }
  }, [chatHistoryMessages, currentStreamingThinkingSteps, currentStreamingAnswerChunk, isStreaming]);


  const handleStreamSend = useCallback(async () => {
    const query = currentInput.trim();
    if (!query || !currentWorkspace || !isSendButtonEnabled) return;

    // 1. Add user message to history
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: "user",
      text: query,
      timestamp: new Date(),
    };
    setChatHistoryMessages((prev) => [...prev, userMessage]);

    // 2. Reset states for the new streaming query
    setCurrentStreamingThinkingSteps([]);
    currentLlmChunkAccumulatorRef.current = "";
    setCurrentStreamingAnswerChunk("");
    setCurrentStreamingProvenance([]);
    
    // 3. Start streaming
    setIsStreaming(true);
    setThinkingPanelOpen(true); // Open thinking panel when starting a new stream
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
            console.log("Received SSE event:", event.step, event);

            if (event.step.startsWith("THINKING")) {
              setCurrentStreamingThinkingSteps(prevSteps => {
                const newSteps = [...prevSteps];
                const lastStep = newSteps[newSteps.length - 1];

                if (event.step === "THINKING_LLM_CHUNKS") {
                  let tokenContent = "";
                  if (typeof event.data === 'string') {
                      tokenContent = event.data;
                  } else if (event.content !== undefined) {
                      tokenContent = event.content;
                  } else if (event.data && typeof event.data === 'object' && event.data.content !== undefined) {
                      tokenContent = event.data.content;
                  }
                  currentLlmChunkAccumulatorRef.current += tokenContent;
                  setCurrentStreamingAnswerChunk(currentLlmChunkAccumulatorRef.current); // Update live answer

                  if (lastStep && lastStep.step === "THINKING_LLM_CHUNKS" && lastStep.status === "progress") {
                    lastStep.data = { content: currentLlmChunkAccumulatorRef.current };
                    return newSteps;
                  } else {
                    return [...newSteps, {
                      ...event,
                      status: "progress",
                      data: { content: currentLlmChunkAccumulatorRef.current }
                    }];
                  }
                } else {
                  if (lastStep && lastStep.step === "THINKING_LLM_CHUNKS" && lastStep.status === "progress") {
                    lastStep.status = "completed";
                    lastStep.data = { content: currentLlmChunkAccumulatorRef.current };
                    currentLlmChunkAccumulatorRef.current = "";
                  }
                  return [...newSteps, { ...event, status: "completed" }];
                }
              });
            }

            if (event.step === "FINAL_RESPONSE") {
              setCurrentStreamingThinkingSteps(prevSteps => {
                const newSteps = [...prevSteps];
                const lastStep = newSteps[newSteps.length - 1];
                if (lastStep && lastStep.step === "THINKING_LLM_CHUNKS" && lastStep.status === "progress") {
                  lastStep.status = "completed";
                  lastStep.data = { content: currentLlmChunkAccumulatorRef.current };
                }
                return newSteps;
              });
              setCurrentStreamingAnswerChunk(event.data.message.synthesis.answer);
              setCurrentStreamingProvenance(event.data.message.synthesis.provenance);
              currentLlmChunkAccumulatorRef.current = ""; // Clear accumulator
            }
          } catch (parseError) {
            console.error("Failed to parse SSE event:", parseError, "Raw line:", line);
          }
        }
      }
    } catch (error) {
      console.error("Streaming search failed:", error);
      setCurrentStreamingThinkingSteps(prevSteps => {
        const newSteps = [...prevSteps];
        const lastStep = newSteps[newSteps.length - 1];
        if (lastStep && lastStep.step === "THINKING_LLM_CHUNKS" && lastStep.status === "progress") {
          lastStep.status = "failed";
          lastStep.data = { content: currentLlmChunkAccumulatorRef.current };
        }
        return newSteps;
      });
      setCurrentStreamingAnswerChunk(`Error: ${error instanceof Error ? error.message : "An unknown error occurred during streaming."}`);
      currentLlmChunkAccumulatorRef.current = "";
    } finally {
      // 4. Finalize the current streaming response and add to history
      const botMessage: ChatMessage = {
        id: `bot-${Date.now()}`,
        type: "bot",
        text: currentStreamingAnswerChunk, // Use the final accumulated answer
        timestamp: new Date(),
        provenance: currentStreamingProvenance,
        thinkingSteps: currentStreamingThinkingSteps, // Store the full thinking process
      };
      setChatHistoryMessages((prev) => [...prev, botMessage]);

      // 5. Reset streaming-specific states
      setCurrentStreamingThinkingSteps([]);
      setCurrentStreamingAnswerChunk("");
      setCurrentStreamingProvenance([]);
      setIsStreaming(false);
      setThinkingPanelOpen(false); // Close thinking dropdown after final response
    }
  }, [currentInput, currentWorkspace, isSendButtonEnabled, selectedEngine, selectedFiles, currentStreamingAnswerChunk, currentStreamingProvenance, currentStreamingThinkingSteps]);

  const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleStreamSend();
    }
  };

  const handleAccordionValueChange = useCallback((value: string) => {
    setThinkingPanelOpen(value === "thinking-panel");
  }, []);

  const BotIcon = botIconComponent;
  const UserIcon = userIconComponent;

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
            {/* Historical Chat Messages */}
            {chatHistoryMessages.length === 0 && !isStreaming && (
              <div className="flex flex-col items-center justify-center h-full">
                <Alert className="max-w-lg text-center">
                  <MessageCircle className="h-6 w-6 mx-auto mb-2" />
                  <AlertTitle>No Chat History Yet!</AlertTitle>
                  <AlertDescription>
                    Start a conversation by typing a message below. Your chat history will appear here.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <div className="space-y-6 pb-8">
              {chatHistoryMessages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    message.type === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.type === "bot" && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-secondary text-secondary-foreground rounded-md">
                        <BotIcon className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={cn(
                      "max-w-[75%] p-3 rounded-xl flex flex-col gap-3",
                      message.type === "user"
                        ? "bg-primary text-primary-foreground rounded-br-none"
                        : "bg-secondary text-secondary-foreground rounded-bl-none"
                    )}
                  >
                    <div className="prose dark:prose-invert text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.text}
                      </ReactMarkdown>
                    </div>
                    {message.type === "bot" && message.provenance && message.provenance.length > 0 && (
                      <ProvenanceDisplay provenance={message.provenance} />
                    )}
                    {message.type === "bot" && message.thinkingSteps && message.thinkingSteps.length > 0 && (
                      <div className="border rounded-lg p-3 bg-card shadow-sm">
                        <Accordion type="single" collapsible className="w-full">
                          <AccordionItem value="historical-thinking-item" className="border-none">
                            <AccordionTrigger className="py-2 text-sm text-primary hover:no-underline">
                              <span className="flex items-center">
                                <Bot className="h-4 w-4 mr-2" />
                                Thinking Process ({message.thinkingSteps.length})
                              </span>
                            </AccordionTrigger>
                            <AccordionContent className="pt-2 pb-0">
                              <div className="space-y-2">
                                {message.thinkingSteps.map((log, i) => (
                                  <div key={i} className="border rounded-md p-3 bg-muted">
                                    <p className="text-xs font-semibold text-primary/80 mb-1">
                                      {log.step.replace("THINKING_", "")}
                                    </p>
                                    <p className="text-xs text-muted-foreground italic mb-2">
                                      Status: {log.status}
                                    </p>
                                    {log.data ? (
                                      <pre className="bg-background p-2 rounded-md text-xs overflow-x-auto">
                                        <code>
                                          {log.step === "THINKING_LLM_CHUNKS" && typeof log.data === 'object' && log.data.content !== undefined
                                            ? log.data.content
                                            : typeof log.data === 'string'
                                              ? log.data
                                              : JSON.stringify(log.data, null, 2)}
                                        </code>
                                      </pre>
                                    ) : (
                                      <p className="text-xs text-muted-foreground">No additional data.</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </div>
                    )}
                    <span className="block text-xs opacity-70 mt-1 text-right">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {message.type === "user" && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground rounded-md">
                        <UserIcon className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}

              {/* Current Query's Live Streaming Content */}
              {isStreaming && (
                <>
                  {/* Current Query's Thinking Dropdown */}
                  <Accordion type="single" collapsible value={thinkingPanelOpen ? "thinking-panel" : ""} onValueChange={handleAccordionValueChange}>
                    <AccordionItem value="thinking-panel" className="border-none">
                      <AccordionTrigger className="py-2 text-lg font-semibold text-primary hover:no-underline">
                        <span className="flex items-center">
                          <Bot className="h-5 w-5 mr-2" />
                          Thinking {thinkingPanelOpen ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-0">
                        <div className="space-y-2 p-3 border rounded-lg bg-secondary/50 text-sm">
                          {currentStreamingThinkingSteps.length === 0 && (
                            <div className="flex items-center">
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              <span>Waiting for first step...</span>
                            </div>
                          )}
                          {currentStreamingThinkingSteps.map((log, i) => (
                            <div key={i} className="thinking-row space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-primary/80">{log.step.replace("THINKING_", "")}</span>
                                <span className="text-muted-foreground">— {log.status}</span>
                                {log.status === "progress" && <Loader2 className="h-3 w-3 animate-spin text-primary ml-auto" />}
                              </div>
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
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  {/* Current Query's Live Final Answer (as it streams) */}
                  {currentStreamingAnswerChunk && (
                    <div className="final-answer mt-6 p-4 border rounded-lg shadow-md bg-card">
                      <h3 className="text-xl font-bold mb-3 flex items-center">
                        <MessageCircle className="h-5 w-5 mr-2 text-primary" /> Live Answer
                      </h3>
                      <div className="prose dark:prose-invert text-base">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {currentStreamingAnswerChunk}
                        </ReactMarkdown>
                      </div>
                      {currentStreamingProvenance.length > 0 && (
                        <ProvenanceDisplay provenance={currentStreamingProvenance} />
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            <div ref={messagesEndRef} /> {/* Scroll target for auto-scrolling */}
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