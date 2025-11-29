"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { MessageCircle, Info, Loader2, Sparkles, Globe, FolderSearch, Zap, FileText, Send, Tag, X, Bot, User } from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getChatHistory, ProvenanceEntry, ChatMessage, listFiles, performSearch, SearchEngineType } from "@/database/workspaceStorage";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import FileFilterDialog from "@/components/FileFilterDialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { iconComponents } from "@/lib/icons"; // Import iconComponents

interface ChatInProps {
  // Removed onShowScrollToBottomChange, onScrollToBottom, chatScrollViewportRef
}

const ChatIn: React.FC<ChatInProps> = ({
  // Removed onShowScrollToBottomChange, onScrollToBottom, chatScrollViewportRef
}) => {
  const { currentWorkspace } = useWorkspace();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null); // Still used for internal scrolling

  const [currentInput, setCurrentInput] = useState("");
  const [selectedEngine, setSelectedEngine] = useState<string>("agent_search");
  const [isFileFilterDialogOpen, setIsFileFilterDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[] | "all">("all");
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [taggedProvenances, setTaggedProvenances] = useState<ProvenanceEntry[]>([]);

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
    return !!currentWorkspace && !isSending && !isLoadingHistory && !(Array.isArray(selectedFiles) && selectedFiles.length === 0);
  }, [currentWorkspace, isSending, isLoadingHistory, selectedFiles]);

  const isSendButtonEnabled = useMemo(() => {
    return isInputAreaEnabled && (currentInput.trim().length > 0 || taggedProvenances.length > 0);
  }, [isInputAreaEnabled, currentInput, taggedProvenances]);

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

        setIsLoadingHistory(true);
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

            let provenance: ProvenanceEntry[] = [];
            if (Array.isArray(entry.source)) {
              provenance = entry.source.filter((item: any) =>
                typeof item === 'object' && item !== null &&
                'id' in item && 'reason' in item && 'snippet' in item
              );
            } else if (typeof entry.source === 'string') {
              const trimmedSource = entry.source.trim();
              if (trimmedSource.startsWith('[') && trimmedSource.endsWith(']')) {
                try {
                  const parsedSource = JSON.parse(trimmedSource);
                  if (Array.isArray(parsedSource)) {
                    provenance = parsedSource.filter((item: any) =>
                      typeof item === 'object' && item !== null &&
                      'id' in item && 'reason' in item && 'snippet' in item
                    );
                  } else if (typeof parsedSource === 'object' && parsedSource !== null && 'id' in parsedSource && 'reason' in parsedSource && 'snippet' in parsedSource) {
                    provenance = [parsedSource as ProvenanceEntry];
                  }
                } catch (e) {
                  console.warn("Failed to parse provenance source as JSON string:", trimmedSource, e);
                }
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
          setMessages(mappedMessages);
        } catch (error) {
          console.error("Failed to fetch chat history:", error);
          setMessages([]);
        } finally {
          setIsLoadingHistory(false);
        }
      } else {
        setAvailableFiles([]);
        setSelectedFiles("all");
        setMessages([]);
      }
    };
    fetchData();

    return () => {
      window.removeEventListener('chatIconsUpdated', loadIcons);
    };
  }, [currentWorkspace, selectedFiles]);

  useEffect(() => {
    if (isLoadingHistory) return;
    const behavior = messages.length > 2 ? 'smooth' : 'auto';
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, [messages, isLoadingHistory]);

  // Removed Effect for handling the visibility of the "scroll to bottom" button

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentInput(e.target.value);
  };

  const handleTagProvenance = useCallback((entry: ProvenanceEntry) => {
    setTaggedProvenances((prev) => {
        if (prev.some(p => p.id === entry.id)) {
            return prev;
        }
        return [...prev, entry];
    });
  }, []);

  const handleRemoveTag = useCallback((id: string) => {
    setTaggedProvenances((prev) => prev.filter(p => p.id !== id));
  }, []);

  const handleSendMessage = useCallback(async (query: string): Promise<{ answer: string; provenance: ProvenanceEntry[] }> => {
    setIsSending(true);
    try {
      if (!currentWorkspace) {
        throw new Error("No workspace selected.");
      }
      if (Array.isArray(selectedFiles) && selectedFiles.length === 0) {
        throw new Error("Please select at least one file to search.");
      }

      const { answer, provenance } = await performSearch(
        currentWorkspace,
        selectedEngine as SearchEngineType,
        query,
        selectedFiles
      );
      return { answer, provenance };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      throw new Error(`Failed to get response: ${errorMessage}`);
    } finally {
      setIsSending(false);
    }
  }, [currentWorkspace, selectedEngine, selectedFiles]);

  const handleSend = async () => {
    let query = currentInput.trim();
    if (taggedProvenances.length > 0) {
        const tagSnippets = taggedProvenances.map(p => p.snippet).join(' ');
        query = `${tagSnippets} ${query}`.trim();
    }

    if (!query || isSending || !currentWorkspace || !isSendButtonEnabled) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: "user",
      text: query,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setCurrentInput("");
    setTaggedProvenances([]);

    try {
      const { answer, provenance } = await handleSendMessage(query);
      const botMessage: ChatMessage = {
        id: `bot-${Date.now()}`,
        type: "bot",
        text: answer,
        timestamp: new Date(),
        provenance: provenance,
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      const botErrorMessage: ChatMessage = {
        id: `bot-error-${Date.now()}`,
        type: "bot",
        text: `Error: ${errorMessage}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botErrorMessage]);
    } finally {
      // isSending is already handled by handleSendMessage's finally block
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

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
              Please select a workspace using the selector in the navigation bar to view chat history.
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <div className="flex flex-col flex-grow mt-4 p-4 space-y-4 border-x-4 border-y-2 rounded-lg">
          <div className="flex-grow flex flex-col border rounded-lg shadow-sm z-[0]">
            <ScrollArea className="flex-grow h-0 w-full !transform-none hide-scrollbar" viewportRef={messagesEndRef}> {/* Changed to messagesEndRef */}
              <div className={cn(
                "p-4 space-y-6 relative",
                (isLoadingHistory || (messages.length === 0 && !isSending)) && "h-full flex items-center justify-center"
              )}>
                {isLoadingHistory ? (
                  <div className="text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
                    <span>Loading chat history...</span>
                  </div>
                ) : messages.length === 0 && !isSending ? (
                  <Alert className="max-w-lg text-center">
                    <MessageCircle className="h-6 w-6 mx-auto mb-2" />
                    <AlertTitle>No Chat History Yet!</AlertTitle>
                    <AlertDescription>
                      Start a conversation by typing a message below. Your chat history will appear here.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    {messages.map((message) => (
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
                            <ReactMarkdown>
                              {message.text}
                            </ReactMarkdown>
                          </div>
                          
                          {message.type === "bot" && message.provenance && message.provenance.length > 0 && (
                            <div className="border rounded-lg p-3 bg-card shadow-sm">
                              <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="provenance-item" className="border-none">
                                  <AccordionTrigger className="py-2 text-sm text-primary hover:no-underline">
                                    <span className="flex items-center">
                                      <FileText className="h-4 w-4 mr-2" />
                                      Thinking Process | Provenance ({message.provenance.length})
                                    </span>
                                  </AccordionTrigger>
                                  <AccordionContent className="pt-2 pb-0">
                                    <div className="space-y-3">
                                      {message.provenance.map((entry, index) => (
                                        <div key={entry.id} className="border rounded-md p-3 bg-muted">
                                          <div className="flex justify-between items-start mb-1">
                                              <p className="text-xs font-semibold text-primary/80">
                                                  Source: {entry.id}
                                              </p>
                                              <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => handleTagProvenance(entry)}
                                                  className="h-6 px-2 py-1 text-xs"
                                              >
                                                  <Tag className="h-3 w-3 mr-1" /> Tag
                                              </Button>
                                          </div>
                                          <p className="text-xs text-muted-foreground italic mb-2">
                                            Reason: {entry.reason}
                                          </p>
                                          <Separator className="my-2" />
                                          <p className="text-sm">
                                            <ReactMarkdown>{entry.snippet}</ReactMarkdown>
                                          </p>
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
                    {isSending && (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
                        <span>Searching...</span>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="flex flex-col gap-2 border rounded-lg px-3 py-2 bg-background shadow-sm">
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
                <div className="flex flex-wrap gap-2 mb-2">
                    {taggedProvenances.map((tag) => (
                        <Tooltip key={tag.id}>
                            <TooltipTrigger asChild>
                                <div className="flex items-center bg-accent text-accent-foreground text-sm px-3 py-1 rounded-full border border-accent cursor-default group">
                                    <span className="truncate max-w-[150px]">{tag.snippet}</span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="ml-2 h-5 w-5 rounded-full text-accent-foreground/70 hover:bg-accent/20 hover:text-accent-foreground"
                                        onClick={() => handleRemoveTag(tag.id)}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="text-sm font-semibold">Source: {tag.id}</p>
                                <p className className="text-xs text-muted-foreground">Reason: {tag.reason}</p>
                            </TooltipContent>
                        </Tooltip>
                    ))}
                </div>
                <Textarea
                    placeholder={currentWorkspace ? "Type your message..." : "Select a workspace to chat"}
                    value={currentInput}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyPress}
                    className="flex-grow min-h-[40px] resize-none border-none focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
                    disabled={!isInputAreaEnabled}
                    rows={1}
                />
                <Button
                    onClick={handleSend}
                    disabled={!isSendButtonEnabled}
                    size="icon"
                    variant="ghost"
                    className="absolute bottom-2 right-2 h-8 w-8 text-primary hover:bg-primary/10"
                    title="Send message"
                >
                    {isSending ? (
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

export default ChatIn;