"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Navbar from "./Navbar";
import { MadeWithDyad } from "./made-with-dyad";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import SidebarNav from "./SidebarNav"; // New import
import { FileStack, BookOpen, FolderCog, MessageCircle, ArrowDown } from "lucide-react"; // Icons for pages, added ArrowDown
import { Button } from "@/components/ui/button"; // Import Button

interface LayoutProps {
  children: React.ReactNode;
}

const pages = [
  { path: "/workspace-management", name: "Workspace Management", icon: FolderCog },
  { path: "/documents", name: "Documents", icon: FileStack },
  { path: "/knowledge-base", name: "Knowledge Base", icon: BookOpen },
  { path: "/chatin", name: "ChatIn", icon: MessageCircle },
];

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const isKnowledgeBase = location.pathname === "/knowledge-base";
  const isChatInPage = location.pathname === "/chatin";

  // State and ref for the scroll-to-bottom button, managed by Layout
  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);
  const chatScrollViewportRef = useRef<HTMLDivElement>(null); // Ref for ChatIn's ScrollArea viewport

  // Function to scroll ChatIn's content to bottom
  const handleScrollToChatBottom = useCallback(() => {
    if (chatScrollViewportRef.current) {
      chatScrollViewportRef.current.scrollTo({
        top: chatScrollViewportRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, []);

  // Pass these props to ChatIn
  const chatInProps = isChatInPage ? {
    onShowScrollToBottomChange: setShowScrollToBottomButton,
    onScrollToBottom: handleScrollToChatBottom,
    chatScrollViewportRef: chatScrollViewportRef,
  } : {};

  // Debugging logs
  console.log("Layout Debug: location.pathname =", location.pathname);
  console.log("Layout Debug: isChatInPage =", isChatInPage);
  console.log("Layout Debug: showScrollToBottomButton (initial/current render) =", showScrollToBottomButton);

  // New useEffect to log when showScrollToBottomButton state actually changes
  useEffect(() => {
    console.log("Layout Debug: showScrollToBottomButton state changed to =", showScrollToBottomButton);
  }, [showScrollToBottomButton]);

  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      
      <div className="flex flex-grow">
        <SidebarNav
          pages={pages}
          currentPath={location.pathname}
        />
        
        <main
          className="flex-grow flex flex-col overflow-y-auto hide-scrollbar"
          style={{ marginLeft: 'var(--sidebar-collapsed-width)', paddingTop: 'var(--navbar-height)' }}
        >
          {isKnowledgeBase ? (
            <div className="h-full w-full bg-background">
              {children}
            </div>
          ) : (
            <div className="mx-auto pt-2 px-6 pb-6 flex flex-col w-full flex-grow">
              {React.Children.map(children, child => {
                if (React.isValidElement(child) && isChatInPage) {
                  return React.cloneElement(child, chatInProps);
                }
                return child;
              })}
            </div>
          )}
        </main>
      </div>

      {/* Scroll to bottom button - Rendered directly in Layout */}
      {isChatInPage && showScrollToBottomButton && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[99] pointer-events-auto">
          <Button
            variant="secondary"
            size="icon"
            className="h-10 w-10 rounded-lg bg-secondary/80 backdrop-blur-sm shadow-md hover:bg-secondary"
            onClick={handleScrollToChatBottom}
            title="Scroll to bottom"
          >
            <ArrowDown className="h-5 w-5" />
          </Button>
        </div>
      )}

      <MadeWithDyad />
    </div>
  );
};

export default Layout;