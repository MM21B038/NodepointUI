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
        "fixed left-0 z-40 flex flex-col border border-border/60 bg-card/95 py-2 shadow-md",
        "rounded-tr-lg rounded-br-lg",
        "w-[var(--sidebar-collapsed-width)]",
        "top-[calc((100vh+var(--navbar-height))/2)] -translate-y-1/2",
        "max-h-[calc(100vh-var(--navbar-height)-1rem)] overflow-y-auto",
        "border-l-0 border-t-primary/30 border-b-primary/30"
      )}
    >
      <nav className="flex flex-col gap-1 px-2">
        {pages.map((page) => {
          const Icon = page.icon;
          const isActive = currentPath.startsWith(page.path);
          
          const navButton = (
            <Button
              variant="ghost"
              className={cn(
                "h-auto w-full justify-center rounded-lg px-3 py-2 transition-colors duration-150",
                "border border-transparent",
                isActive
                  ? "border-primary/25 bg-primary/10 text-primary shadow-sm hover:bg-primary/10 hover:text-primary"
                  : "bg-secondary/80 text-muted-foreground hover:border-border/60 hover:bg-accent hover:text-foreground",
                "active:scale-[0.96]"
              )}
            >
              <Icon className="h-5 w-5 min-w-[20px]" />
              <span className="sr-only">{page.name}</span> 
            </Button>
          );

          return (
            <Link to={page.path} key={page.path} className="block w-full">
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