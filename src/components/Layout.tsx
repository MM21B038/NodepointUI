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
          "flex-grow",
          // Default padding for other pages
          !isKnowledgeBase && "p-4",
          // Full height/width for Knowledge Base
          isKnowledgeBase && "h-[calc(100vh-64px)] flex flex-col" // Assuming Navbar is ~64px tall
        )}
      >
        <div className={cn(
          "h-full",
          !isKnowledgeBase && "container mx-auto"
        )}>
          {children}
        </div>
      </main>
      
      <MadeWithDyad />
    </div>
  );
};

export default Layout;