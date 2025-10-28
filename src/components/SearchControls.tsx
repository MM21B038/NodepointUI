"use client";

import React, { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator, // Added import for DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, Search, FileSearch } from "lucide-react";
import { SearchEngineType, listFiles } from "@/database/workspaceStorage";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface SearchControlsProps {
  workspaceName: string;
  onSearchSettingsChange: (engine: SearchEngineType, files: string[] | "all") => void;
}

const SearchControls: React.FC<SearchControlsProps> = ({
  workspaceName,
  onSearchSettingsChange,
}) => {
  const [selectedEngine, setSelectedEngine] = useState<SearchEngineType>("agent_search");
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[] | "all">("all");

  useEffect(() => {
    const fetchFiles = async () => {
      if (workspaceName) {
        try {
          const files = await listFiles(workspaceName);
          setAvailableFiles(files);
        } catch (error) {
          console.error("Failed to fetch workspace files:", error);
          toast.error("Failed to load workspace files.");
        }
      }
    };
    fetchFiles();
  }, [workspaceName]);

  useEffect(() => {
    onSearchSettingsChange(selectedEngine, selectedFiles);
  }, [selectedEngine, selectedFiles, onSearchSettingsChange]);

  const handleEngineChange = (value: string) => {
    setSelectedEngine(value as SearchEngineType);
  };

  const handleFileSelectionChange = (fileName: string, checked: boolean) => {
    if (checked) {
      if (selectedFiles === "all") {
        setSelectedFiles([fileName]);
      } else {
        setSelectedFiles([...selectedFiles, fileName]);
      }
    } else {
      if (selectedFiles !== "all") {
        const updatedFiles = selectedFiles.filter((file) => file !== fileName);
        setSelectedFiles(updatedFiles.length === 0 ? "all" : updatedFiles);
      }
    }
  };

  const handleSelectAllFiles = (checked: boolean) => {
    if (checked) {
      setSelectedFiles("all");
    } else {
      setSelectedFiles([]);
    }
  };

  const isFileSelected = (fileName: string) => {
    return selectedFiles === "all" || (Array.isArray(selectedFiles) && selectedFiles.includes(fileName));
  };

  const searchEngineOptions = [
    { value: "agent_search", label: "Agent Search" },
    { value: "global_search", label: "Global Search" },
    { value: "local_search", label: "Local Search" },
    { value: "hybrid_search", label: "Hybrid Search" },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label htmlFor="search-engine" className="text-sm font-medium flex items-center">
          <Search className="h-4 w-4 mr-2 text-muted-foreground" /> Search Engine
        </Label>
        <Select value={selectedEngine} onValueChange={handleEngineChange}>
          <SelectTrigger id="search-engine" className="w-full">
            <SelectValue placeholder="Select Search Engine" />
          </SelectTrigger>
          <SelectContent>
            {searchEngineOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div className="space-y-3">
        <Label htmlFor="files-to-search" className="text-sm font-medium flex items-center">
          <FileSearch className="h-4 w-4 mr-2 text-muted-foreground" /> Files to Search
        </Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between" id="files-to-search">
              {selectedFiles === "all"
                ? "All Files"
                : Array.isArray(selectedFiles) && selectedFiles.length > 0
                ? `${selectedFiles.length} File(s) Selected`
                : "No Files Selected"}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <ScrollArea className="max-h-[200px]">
              <DropdownMenuCheckboxItem
                checked={selectedFiles === "all"}
                onCheckedChange={handleSelectAllFiles}
              >
                All Files
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {availableFiles.length === 0 ? (
                <DropdownMenuCheckboxItem disabled>
                  No files available
                </DropdownMenuCheckboxItem>
              ) : (
                availableFiles.map((file) => (
                  <DropdownMenuCheckboxItem
                    key={file}
                    checked={isFileSelected(file)}
                    onCheckedChange={(checked) => handleFileSelectionChange(file, checked)}
                  >
                    {file}
                  </DropdownMenuCheckboxItem>
                ))
              )}
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default SearchControls;