"use client";

import React, { useState, useRef, useCallback } from "react";
import Navbar from "./Navbar";
import { MadeWithDyad } from "./made-with-dyad";
import { useLocation } from "react-router-dom";
import SidebarNav from "./SidebarNav";
import { FileStack, BookOpen, FolderCog, MessageCircle, ArrowDown } from "lucide-react";
import { Button } from "./ui/button";

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

  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const chatScrollViewportRef = useRef<HTMLDivElement>(null);

  const handleScrollToBottom = useCallback(() => {
    if (chatScrollViewportRef.current) {
      chatScrollViewportRef.current.scrollTo({
        top: chatScrollViewportRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, []);

  const chatInProps = {
    onShowScrollToBottomChange: setShowScrollToBottom,
    chatScrollViewportRef,
  };

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
              {isChatInPage && React.isValidElement(children)
                ? React.cloneElement(children, chatInProps)
                : children}
            </div>
          )}
        </main>
      </div>

      {isChatInPage && showScrollToBottom && (
        <Button
          variant="outline"
          size="icon"
          className="absolute bottom-20 right-10 z-50 rounded-full shadow-lg"
          onClick={handleScrollToBottom}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      )}

      <MadeWithDyad />
    </div>
  );
};

export default Layout;