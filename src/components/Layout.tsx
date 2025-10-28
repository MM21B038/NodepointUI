"use client";

import React from "react";
import Navbar from "./Navbar";
import { MadeWithDyad } from "./made-with-dyad";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const isKnowledgeBase = location.pathname === "/knowledge-base";

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      
      <main 
        className={cn(
          "flex-grow flex flex-col", // Ensure main takes full height and is a flex container
          // Removed the conditional "p-4" from here, children will manage their own padding
          isKnowledgeBase && "h-[calc(100vh-64px)]" // Keep specific height for Knowledge Base if needed
        )}
      >
        <div className={cn(
          "h-full w-full", // Ensure this div takes full height and width of main
          !isKnowledgeBase && "container mx-auto" // Apply container for non-KB pages
        )}>
          {children}
        </div>
      </main>
      
      <MadeWithDyad />
    </div>
  );
};

export default Layout;