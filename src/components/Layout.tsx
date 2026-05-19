"use client";

import React from "react";
import Navbar from "./Navbar";
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
  const path =
    location.pathname.length > 1
      ? location.pathname.replace(/\/+$/, "")
      : location.pathname;
  const isFullBleed = path === "/knowledge-base" || path === "/chat";
  const isWorkspacePage =
    path === "/workspace-management" || path === "/";

  return (
    <div className="flex flex-col h-screen">
      <Navbar />

      <div
        className={cn(
          "flex min-h-0 flex-1 overflow-hidden",
          isFullBleed && "pt-[var(--navbar-height)]"
        )}
      >
        <SidebarNav pages={pages} currentPath={location.pathname} />

        <main
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col hide-scrollbar",
            isFullBleed || isWorkspacePage
              ? "h-full overflow-hidden"
              : "overflow-y-auto"
          )}
          style={{
            marginLeft: "var(--sidebar-collapsed-width)",
            ...(!isFullBleed ? { paddingTop: "var(--navbar-height)" } : {}),
          }}
        >
          {isFullBleed ? (
            <div className="flex h-full min-h-0 flex-1 flex-col w-full overflow-hidden bg-background">
              {children}
            </div>
          ) : isWorkspacePage ? (
            <div className="flex h-full min-h-0 flex-1 flex-col w-full overflow-hidden px-4 py-3">
              {children}
            </div>
          ) : (
            <div className="mx-auto pt-2 px-6 pb-6 flex flex-col w-full flex-grow">
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Layout;
