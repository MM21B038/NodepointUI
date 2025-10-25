"use client";

import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import WorkspaceSelector from "./WorkspaceSelector";

const Navbar = () => {
  return (
    <nav className="bg-primary text-primary-foreground p-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-2xl font-bold">My App</h1>
        <div className="flex items-center space-x-6">
          <div className="space-x-4">
            <Button asChild variant="ghost" className="text-primary-foreground hover:bg-primary/80">
              <Link to="/documents">Documents</Link>
            </Button>
            <Button asChild variant="ghost" className="text-primary-foreground hover:bg-primary/80">
              <Link to="/knowledge-base">Knowledge Base</Link>
            </Button>
            <Button asChild variant="ghost" className="text-primary-foreground hover:bg-primary/80">
              <Link to="/ask">Ask</Link>
            </Button>
          </div>
          <WorkspaceSelector />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;