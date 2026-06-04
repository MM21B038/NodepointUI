"use client";

import React from "react";
import { Link, useLocation } from "react-router-dom";
import WorkspaceControl from "./WorkspaceControl";
import ThemeSwitcher from "./ThemeSwitcher";
import UserMenu from "@/components/auth/UserMenu";
import LogoutButton from "@/components/auth/LogoutButton";
import { NodepointLogo } from "@/components/brand/NodepointLogo";
import { cn } from "@/lib/utils";

const Navbar = () => {
  const location = useLocation();
  const isKnowledgeBase = location.pathname === "/knowledge-base";

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 w-full z-50 border-b border-border/60 bg-background/95 py-3 shadow-sm backdrop-blur-md",
        isKnowledgeBase ? "navbar-translucent" : "navbar-opaque"
      )}
    >
      <div className="w-full px-6 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Link
            to="/"
            className="flex items-center space-x-2.5 text-lg font-bold text-foreground hover:text-primary transition-colors"
            aria-label="Nodepoint home"
          >
            <NodepointLogo size={24} />
            <span>Nodepoint</span>
          </Link>
          <WorkspaceControl />
        </div>

        <div className="flex items-center space-x-2">
          <UserMenu />
          <LogoutButton variant="outline" size="sm" />
          <ThemeSwitcher />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
