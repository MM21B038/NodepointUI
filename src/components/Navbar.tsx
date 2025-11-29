"use client";

import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import WorkspaceControl from "./WorkspaceControl";
import ThemeSwitcher from "./ThemeSwitcher";
import { Brush, GitGraph } from "lucide-react"; // Added GitGraph for app title icon
import { cn } from "@/lib/utils";
import IconSelectionDialog from "./IconSelectionDialog";

const Navbar = () => {
  const location = useLocation();
  const [isIconSelectionDialogOpen, setIsIconSelectionDialogOpen] = useState(false);
  const [botIconName, setBotIconName] = useState("Bot"); // Default bot icon
  const [userIconName, setUserIconName] = useState("User"); // Default user icon

  useEffect(() => {
    // Load icons from localStorage on component mount
    const savedBotIcon = localStorage.getItem("chatBotIcon");
    const savedUserIcon = localStorage.getItem("chatUserIcon");
    if (savedBotIcon) setBotIconName(savedBotIcon);
    if (savedUserIcon) setUserIconName(savedUserIcon);
  }, []);

  const handleSaveIcons = (newBotIconName: string, newUserIconName: string) => {
    setBotIconName(newBotIconName);
    setUserIconName(newUserIconName);
    localStorage.setItem("chatBotIcon", newBotIconName);
    localStorage.setItem("chatUserIcon", newUserIconName);
    // Dispatch a custom event to notify other components (like ChatIn)
    window.dispatchEvent(new CustomEvent('chatIconsUpdated'));
  };

  const isKnowledgeBase = location.pathname === "/knowledge-base";
  const isChatInPage = location.pathname === "/chatin";

  return (
    <nav className={cn(
      "fixed top-0 left-0 w-full z-50 py-4 shadow-md",
      isKnowledgeBase ? "navbar-translucent" : "navbar-opaque"
    )}>
      <div className="w-full px-6 flex justify-between items-center">
        {/* Left-aligned items */}
        <div className="flex items-center space-x-4">
          <Link to="/" className="flex items-center space-x-2 text-lg font-bold text-foreground hover:text-primary transition-colors">
            <GitGraph className="h-6 w-6" />
            <span>PRAJNA</span>
          </Link>
          <WorkspaceControl />
        </div>

        {/* Right-aligned items */}
        <div className="flex items-center space-x-4">
          {isChatInPage && (
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setIsIconSelectionDialogOpen(true)}
              title="Customize Chat Icons"
            >
              <Brush className="h-4 w-4" />
            </Button>
          )}
          <ThemeSwitcher />
        </div>
      </div>
      <IconSelectionDialog
        isOpen={isIconSelectionDialogOpen}
        onClose={() => setIsIconSelectionDialogOpen(false)}
        onSave={handleSaveIcons}
        currentBotIconName={botIconName}
        currentUserIconName={userIconName}
      />
    </nav>
  );
};

export default Navbar;