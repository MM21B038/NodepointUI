"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Navbar from "./Navbar";
import { MadeWithDyad } from "./made-with-dyad";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import SidebarNav from "./SidebarNav";
import { FileStack, BookOpen, FolderCog, MessageCircle } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

const pages = [
  { path: "/workspace-management", name: "Workspace Management", icon: FolderCog },
  { path: "/documents", name: "Documents", icon: FileStack },
  { path: "/knowledge-base", name: "Knowledge Base", icon: BookOpen },
  { path: "/chatin", name: "ChatIn", icon: MessageCircle },
  { path: "/stream", name: "Stream", icon: MessageCircle }, // New entry for Stream
];

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const isKnowledgeBase = location.pathname === "/knowledge-base";

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

      <MadeWithDyad />
    </div>
  );
};

export default Layout;