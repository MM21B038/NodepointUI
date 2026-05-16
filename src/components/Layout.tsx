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
  { path: "/chat", name: "Chat", icon: MessageCircle },
];

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const isFullBleed =
    location.pathname === "/knowledge-base" || location.pathname === "/chat";

  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <SidebarNav
          pages={pages}
          currentPath={location.pathname}
        />
        
        <main
          className={cn(
            "flex flex-1 flex-col min-h-0 min-w-0 hide-scrollbar",
            isFullBleed ? "overflow-hidden" : "overflow-y-auto"
          )}
          style={{
            marginLeft: "var(--sidebar-collapsed-width)",
            ...(isFullBleed
              ? {
                  marginTop: "var(--navbar-height)",
                  height: "calc(100vh - var(--navbar-height))",
                }
              : { paddingTop: "var(--navbar-height)" }),
          }}
        >
          {isFullBleed ? (
            <div className="flex flex-1 flex-col min-h-0 w-full bg-background overflow-hidden">
              {children}
            </div>
          ) : (
            <div className="mx-auto pt-2 px-6 pb-6 flex flex-col w-full flex-grow">
              {children}
            </div>
          )}
        </main>
      </div>

      {!isFullBleed && <MadeWithDyad />}
    </div>
  );
};

export default Layout;