"use client";

import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Page {
  path: string;
  name: string;
  icon: LucideIcon;
}

interface SidebarNavProps {
  pages: Page[];
  currentPath: string;
}

const SidebarNav: React.FC<SidebarNavProps> = ({
  pages,
  currentPath,
}) => {
  // The sidebar will now always be in a collapsed state
  const isExpanded = false; 

  return (
    <div
      className={cn(
        "fixed left-0 z-40 bg-card border-r border-t-4 border-b-4 shadow-lg transition-all duration-300 ease-in-out flex flex-col py-4",
        "rounded-tr-lg rounded-br-lg", // Only round top-right and bottom-right
        "w-[var(--sidebar-collapsed-width)]", // Always use collapsed width
        "top-1/2 -translate-y-1/2", // Vertically center the sidebar
        "max-h-[calc(100vh - var(--navbar-height) - var(--footer-height) - 2rem)]", // Adjust max height to leave space top/bottom
        "border-t-[color:hsl(var(--sidebar-accent-border))] border-b-[color:hsl(var(--sidebar-accent-border))]" // Apply custom color
      )}
    >
      <nav className="flex-grow px-2">
        {pages.map((page) => {
          const Icon = page.icon;
          const isActive = currentPath.startsWith(page.path);
          
          const navButton = (
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-center h-auto py-2.5 px-3 rounded-md",
                "bg-secondary shadow-sm", // Use bg-secondary for distinct block, add shadow
                "text-secondary-foreground hover:shadow-md", // Removed hover:bg-secondary/80
                isActive ? "bg-card text-card-foreground font-semibold hover:bg-card" : "", // Active state: bg-card, text-card-foreground, and explicitly hover:bg-card
                "transition-all duration-150 active:scale-[0.96] active:shadow-none" // Enhanced active state: scale down more, remove shadow
              )}
            >
              <Icon className="h-5 w-5 min-w-[20px]" />
              <span className="sr-only">{page.name}</span> 
            </Button>
          );

          return (
            <Link to={page.path} key={page.path} className="w-full mb-2 block">
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  {navButton}
                </TooltipTrigger>
                <TooltipContent side="right" className="ml-2">
                  {page.name}
                </TooltipContent>
              </Tooltip>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default SidebarNav;