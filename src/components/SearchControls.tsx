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
import { ChevronDown, Search } from "lucide-react";
import { SearchEngineType, listFiles } from "@/database/workspaceStorage"; // Corrected import to listFiles
import { toast } from "sonner";

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
          const files = await listFiles(workspaceName); // Corrected function call to listFiles
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
    return selectedFiles === "all" || selectedFiles.includes(fileName);
  };

  return (
    <div className="w-64 flex-shrink-0 bg-card border-r p-6 space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold flex items-center">
          <Search className="h-4 w-4 mr-2" /> Search Engine
        </h3>
        <RadioGroup
          value={selectedEngine}
          onValueChange={handleEngineChange}
          className="grid gap-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="agent_search" id="agent_search" />
            <Label htmlFor="agent_search">Agent Search</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="keyword_search" id="keyword_search" />
            <Label htmlFor="keyword_search">Keyword Search</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold flex items-center">
          <Search className="h-4 w-4 mr-2" /> Files to Search
        </h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              {selectedFiles === "all"
                ? "All Files"
                : selectedFiles.length > 0
                ? `${selectedFiles.length} File(s) Selected`
                : "No Files Selected"}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuCheckboxItem
              checked={selectedFiles === "all"}
              onCheckedChange={handleSelectAllFiles}
            >
              All Files
            </DropdownMenuCheckboxItem>
            {availableFiles.map((file) => (
              <DropdownMenuCheckboxItem
                key={file}
                checked={isFileSelected(file)}
                onCheckedChange={(checked) => handleFileSelectionChange(file, checked)}
              >
                {file}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default SearchControls;