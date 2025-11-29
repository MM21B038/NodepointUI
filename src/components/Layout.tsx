"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Navbar from "./Navbar";
import { MadeWithDyad } from "./made-with-dyad";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import SidebarNav from "./SidebarNav"; // New import
import { FileStack, BookOpen, FolderCog, MessageCircle } from "lucide-react"; // Removed ArrowDown

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
  // const isChatInPage = location.pathname === "/chatin"; // No longer needed

  // Removed state and ref for the scroll-to-bottom button
  // Removed function to scroll ChatIn's content to bottom
  // Removed chatInProps and React.cloneElement logic

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
              {children}
            </div>
          )}
        </main>
      </div>

      {/* Removed Scroll to bottom button */}

      <MadeWithDyad />
    </div>
  );
};

export default Layout;