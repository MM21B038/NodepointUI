"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface SearchNodesPanelProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchDepth: number;
  onSearchDepthChange: (depth: number) => void;
  onClose: () => void;
  onFilterInteraction: () => void;
  // New prop to communicate dropdown's open state to parent
  onDropdownOpenChange: (isOpen: boolean) => void;
}

const SearchNodesPanel: React.FC<SearchNodesPanelProps> = ({
  searchQuery,
  onSearchQueryChange,
  searchDepth,
  onSearchDepthChange,
  onClose,
  onFilterInteraction,
  onDropdownOpenChange, // Destructure new prop
}) => {
  const [isDepthDropdownOpen, setIsDepthDropdownOpen] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchQueryChange(e.target.value);
    onFilterInteraction();
  };

  const handleDepthSelect = (depth: number) => {
    onSearchDepthChange(depth);
    onFilterInteraction();
  };

  const depthOptions = Array.from({ length: 6 }, (_, i) => i);

  return (
    <Card className="h-full bg-background/80 backdrop-blur-sm border-none shadow-lg">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center">
          <Search className="h-5 w-5 mr-2" />
          <CardTitle className="text-xl">Search Nodes</CardTitle>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} title="Close Search Panel">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="h-[calc(100%-60px)] flex flex-col p-4">
        <Label htmlFor="node-search" className="sr-only">Search Nodes</Label>
        <Input
          id="node-search"
          placeholder="Search by label or ID..."
          value={searchQuery}
          onChange={handleChange}
          className="mt-1 bg-background/50 border-primary/20"
        />

        <div className="mt-6 space-y-2">
          <Label htmlFor="search-depth" className="text-sm font-medium">
            Search Depth:
          </Label>
          <DropdownMenu
            open={isDepthDropdownOpen}
            onOpenChange={(isOpen) => {
              setIsDepthDropdownOpen(isOpen);
              onDropdownOpenChange(isOpen); // Communicate state change to parent
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between bg-background/50 border-primary/20"
                disabled={!searchQuery}
              >
                {searchDepth} {searchDepth === 0 ? "(Only searched nodes)" : "hops"}
                <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-full search-depth-dropdown-content">
              {depthOptions.map((depth) => (
                <DropdownMenuItem
                  key={depth}
                  onClick={() => {
                    handleDepthSelect(depth);
                    setIsDepthDropdownOpen(false);
                    onDropdownOpenChange(false); // Ensure parent knows it's closed
                  }}
                  className={cn(
                    "cursor-pointer",
                    searchDepth === depth && "bg-accent text-accent-foreground"
                  )}
                >
                  {depth} {depth === 0 ? "(Only searched nodes)" : "hops"}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <p className="text-xs text-muted-foreground">
            Controls how many "hops" away from the searched node(s) are displayed.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default SearchNodesPanel;