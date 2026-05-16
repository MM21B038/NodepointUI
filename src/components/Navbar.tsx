"use client";

import React from "react";
import { Link, useLocation } from "react-router-dom";
import WorkspaceControl from "./WorkspaceControl";
import ThemeSwitcher from "./ThemeSwitcher";
import { GitGraph } from "lucide-react";
import { cn } from "@/lib/utils";

const Navbar = () => {
  const location = useLocation();
  const isKnowledgeBase = location.pathname === "/knowledge-base";

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 w-full z-50 py-4 shadow-md",
        isKnowledgeBase ? "navbar-translucent" : "navbar-opaque"
      )}
    >
      <div className="w-full px-6 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Link
            to="/"
            className="flex items-center space-x-2 text-lg font-bold text-foreground hover:text-primary transition-colors"
          >
            <GitGraph className="h-6 w-6" />
            <span>Nodepoint</span>
          </Link>
          <WorkspaceControl />
        </div>

        <div className="flex items-center space-x-4">
          <ThemeSwitcher />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
