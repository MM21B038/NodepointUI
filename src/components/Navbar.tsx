"use client";

import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import WorkspaceSelector from "./WorkspaceSelector";
import ThemeSwitcher from "./ThemeSwitcher";

const Navbar = () => {
  return (
    <nav className="bg-[--nav-background] text-[--nav-foreground] p-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-2xl font-bold">My App</h1>
        <div className="flex items-center space-x-6">
          <div className="space-x-4">
            {/* Buttons now use ghost variant with hover colors adjusted for the new nav background */}
            <Button asChild variant="ghost" className="text-[--nav-foreground] hover:bg-[--nav-background]/80">
              <Link to="/documents">Documents</Link>
            </Button>
            <Button asChild variant="ghost" className="text-[--nav-foreground] hover:bg-[--nav-background]/80">
              <Link to="/knowledge-base">Knowledge Base</Link>
            </Button>
            <Button asChild variant="ghost" className="text-[--nav-foreground] hover:bg-[--nav-background]/80">
              <Link to="/ask">Ask</Link>
            </Button>
          </div>
          <WorkspaceSelector />
          <ThemeSwitcher />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;