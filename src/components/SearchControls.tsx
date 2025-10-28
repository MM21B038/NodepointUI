"use client";

import React, { useState, useEffect } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Search, Bot, FileSearch } from "lucide-react"; // Added Bot, FileSearch
import { SearchEngineType, listFiles } from "@/database/workspaceStorage";
import { toast } from "sonner";
import { cn } from "@/lib/utils"; // Import cn for conditional classNames
import { ScrollArea } from "@/components/ui/scroll-area"; // Import ScrollArea

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
    {
      value: "agent_search",
      label: "Agent Search",
      description: "Leverages an AI agent to perform multi-step reasoning and synthesis.",
      icon: Bot,
    },
    {
      value: "keyword_search",
      label: "Keyword Search",
      description: "Performs a direct keyword match across documents for quick retrieval.",
      icon: FileSearch,
    },
  ];

  return (
    <div className="w-64 flex-shrink-0 bg-card border-r p-6 space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          <Search className="h-4 w-4 mr-2" /> Search Engine
        </h3>
        <RadioGroup
          value={selectedEngine}
          onValueChange={handleEngineChange}
          className="grid gap-3"
        >
          {searchEngineOptions.map((option) => (
            <Label
              key={option.value}
              htmlFor={option.value}
              className={cn(
                "flex flex-col items-start space-y-1 rounded-md border p-3 cursor-pointer",
                "hover:bg-accent hover:text-accent-foreground",
                selectedEngine === option.value && "border-primary ring-2 ring-primary/50 bg-primary/5"
              )}
            >
              <div className="flex items-center w-full">
                <RadioGroupItem value={option.value} id={option.value} className="mr-2" />
                <option.icon className="h-4 w-4 mr-2 text-primary" />
                <span className="font-medium">{option.label}</span>
              </div>
              <p className="text-xs text-muted-foreground ml-7">{option.description}</p>
            </Label>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold flex items-center">
          <FileSearch className="h-4 w-4 mr-2" /> Files to Search
        </h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              {selectedFiles === "all"
                ? "All Files"
                : Array.isArray(selectedFiles) && selectedFiles.length > 0
                ? `${selectedFiles.length} File(s) Selected`
                : "No Files Selected"}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <ScrollArea className="max-h-[200px]"> {/* Added ScrollArea */}
              <DropdownMenuCheckboxItem
                checked={selectedFiles === "all"}
                onCheckedChange={handleSelectAllFiles}
              >
                All Files
              </DropdownMenuCheckboxItem>
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