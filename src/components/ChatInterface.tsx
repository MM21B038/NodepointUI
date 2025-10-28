"use client";

import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Bot, User, ChevronDown, ChevronUp } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ProvenanceEntry } from "@/database/workspaceStorage";

export interface ChatMessage {
  id: string;
  type: "user" | "bot";
  text: string;
  timestamp: Date;
  provenance?: ProvenanceEntry[];
}

interface ChatInterfaceProps {
  onSendMessage: (query: string) => Promise<{ answer: string; provenance: ProvenanceEntry[] }>;
  isLoadingSearch: boolean;
  isWorkspaceSelected: boolean;
  className?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  onSendMessage,
  isLoadingSearch,
  isWorkspaceSelected,
  className,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isLoadingSearch]);

  const handleSend = async () => {
    const query = currentInput.trim();
    if (!query || isSending || !isWorkspaceSelected) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: "user",
      text: query,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setCurrentInput("");
    setIsSending(true);

    try {
      const { answer, provenance } = await onSendMessage(query);
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
      setIsSending(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={cn("flex flex-col bg-background border rounded-lg shadow-sm", className)}>
      <div className="flex-grow flex flex-col">
        {messages.length === 0 && (
          <div className="flex-grow flex items-center justify-center">
            <p className="text-muted-foreground">Start a conversation!</p>
          </div>
        )}
        {messages.length > 0 && (
          <ScrollArea className="flex-grow min-h-0" ref={scrollAreaRef}>
            <div className="p-4 space-y-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex items-start gap-3",
                    message.type === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.type === "bot" && (
                    <div className="flex-shrink-0 p-2 rounded-full bg-secondary text-secondary-foreground">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[75%] p-3 rounded-xl border",
                      message.type === "user"
                        ? "bg-primary text-primary-foreground border-primary/50"
                        : "bg-muted text-muted-foreground border-muted-foreground/20"
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                    {message.type === "bot" && message.provenance && message.provenance.length > 0 && (
                      <ProvenanceDisplay provenance={message.provenance} />
                    )}
                    <span className="block text-xs opacity-70 mt-2 text-right">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {message.type === "user" && (
                    <div className="flex-shrink-0 p-2 rounded-full bg-primary text-primary-foreground">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
        {isLoadingSearch && (
          <div className="flex items-center justify-center py-4 flex-shrink-0">
            <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
            <span className="text-muted-foreground">Searching...</span>
          </div>
        )}
      </div>
      <div className="border-t p-4 flex items-center gap-2 flex-shrink-0">
        <Input
          placeholder={isWorkspaceSelected ? "Type your message..." : "Select a workspace to chat"}
          value={currentInput}
          onChange={(e) => setCurrentInput(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isSending || !isWorkspaceSelected || isLoadingSearch}
          className="flex-grow"
        />
        <Button
          onClick={handleSend}
          disabled={isSending || !currentInput.trim() || !isWorkspaceSelected || isLoadingSearch}
        >
          {isSending || isLoadingSearch ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          <span className="sr-only">Send message</span>
        </Button>
      </div>
    </div>
  );
};

interface ProvenanceDisplayProps {
  provenance: ProvenanceEntry[];
}

const ProvenanceDisplay: React.FC<ProvenanceDisplayProps> = ({ provenance }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-3 pt-3 border-t border-muted-foreground/30">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-start text-xs text-muted-foreground hover:bg-muted-foreground/10 px-2 py-1 h-auto"
      >
        {isOpen ? (
          <ChevronUp className="h-3 w-3 mr-1" />
        ) : (
          <ChevronDown className="h-3 w-3 mr-1" />
        )}
        Thinking Process (Provenance)
      </Button>
      {isOpen && (
        <div className="mt-2 space-y-3 text-xs bg-background/70 p-3 rounded-lg border border-dashed">
          {provenance.map((entry, index) => (
            <div key={index} className="pb-1 border-b border-dashed last:border-b-0">
              <p className="font-semibold text-primary/80">Source ID: {entry.id}</p>
              <p className="text-muted-foreground italic mt-1">Reason: {entry.reason}</p>
              <p className="text-foreground/80 mt-1 line-clamp-3">{entry.snippet}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChatInterface;