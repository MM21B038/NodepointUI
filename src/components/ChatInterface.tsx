"use client";

import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Bot, User, ChevronDown, ChevronUp } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ProvenanceEntry } from "@/database/workspaceStorage";
import { Separator } from "@/components/ui/separator";
import ReactMarkdown from "react-markdown"; // Import ReactMarkdown
import remarkGfm from 'remark-gfm'; // Import remark-gfm
import ProvenanceDisplay from "./ProvenanceDisplay"; // Import the new ProvenanceDisplay component

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
      // The ScrollArea component from shadcn/ui wraps the actual viewport.
      // We need to find the viewport element to scroll it.
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: "smooth",
        });
      }
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
    <div className={cn("flex flex-col h-full bg-background", className)}>
      <ScrollArea className="flex-grow h-0 hide-scrollbar" ref={scrollAreaRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-grow p-4">
            <div className="text-muted-foreground text-lg">
              Start a conversation!
            </div>
          </div>
        ) : (
          <div className="space-y-6 p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex items-start gap-3",
                  message.type === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.type === "bot" && (
                  <div className="flex-shrink-0 p-2 rounded-full bg-secondary text-secondary-foreground shadow-sm">
                    <Bot className="h-4 w-4" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[75%] p-4 rounded-2xl shadow-md relative",
                    message.type === "user"
                      ? "bg-primary text-primary-foreground rounded-br-none"
                      : "bg-muted text-muted-foreground rounded-bl-none"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap prose dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
                  </p>
                  {message.type === "bot" && message.provenance && message.provenance.length > 0 && (
                    <ProvenanceDisplay provenance={message.provenance} />
                  )}
                  <span className="block text-xs opacity-70 mt-2 text-right">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {message.type === "user" && (
                  <div className="flex-shrink-0 p-2 rounded-full bg-primary text-primary-foreground shadow-sm">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
      {isLoadingSearch && (
        <div className="flex items-center justify-center py-4 flex-shrink-0 border-t bg-background/50">
          <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
          <span className="text-muted-foreground">Searching...</span>
        </div>
      )}
      <div className="border-t p-4 flex items-center gap-2 flex-shrink-0 bg-background">
        <Input
          placeholder={isWorkspaceSelected ? "Type your message..." : "Select a workspace to chat"}
          value={currentInput}
          onChange={(e) => setCurrentInput(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isSending || !isWorkspaceSelected || isLoadingSearch}
          className="flex-grow p-3 text-base"
        />
        <Button
          onClick={handleSend}
          disabled={isSending || !currentInput.trim() || !isWorkspaceSelected || isLoadingSearch}
          size="icon"
          className="h-10 w-10"
        >
          {isSending || isLoadingSearch ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
          <span className="sr-only">Send message</span>
        </Button>
      </div>
    </div>
  );
};

export default ChatInterface;