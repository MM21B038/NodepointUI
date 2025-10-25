"use client";

import React from "react";
import Navbar from "./Navbar";
import { MadeWithDyad } from "./made-with-dyad";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      {/* Adjusted main to use flex-grow and remove fixed padding/container for full-width/height pages like KnowledgeBase */}
      <main className="flex-grow p-4">
        <div className="container mx-auto h-full">
          {children}
        </div>
      </main>
      <MadeWithDyad />
    </div>
  );
};

export default Layout;