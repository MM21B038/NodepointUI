"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Loader2, Files, Search } from "lucide-react";
import { toast } from "sonner";
import { listFiles, SearchEngineType } from "@/database/workspaceStorage";
import { cn } from "@/lib/utils";

interface SearchControlsProps {
  workspaceName: string | null;
  onSearchSettingsChange: (engine: SearchEngineType, files: string[] | "all") => void;
}

const searchEngines: { value: SearchEngineType; label: string }[] = [
  { value: "agent_search", label: "Agent Search" },
  { value: "global_search", label: "Global Search" },
  { value: "local_search", label: "Local Search" },
  { value: "hybrid_search", label: "Hybrid Search" },
];

const SearchControls: React.FC<SearchControlsProps> = ({
  workspaceName,
  onSearchSettingsChange,
}) => {
  const [selectedEngine, setSelectedEngine] = useState<SearchEngineType>("agent_search");
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isAllFilesSelected, setIsAllFilesSelected] = useState(true);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  const fetchFiles = useCallback(async (name: string) => {
    setIsLoadingFiles(true);
    try {
      const files = await listFiles(name);
      setAvailableFiles(files);
      // If "All files" was selected, re-select all new files
      if (isAllFilesSelected) {
        setSelectedFiles(new Set(files));
      } else {
        // Otherwise, ensure only previously selected files that still exist are kept
        setSelectedFiles(prev => new Set(files.filter(file => prev.has(file))));
      }
    } catch (error) {
      toast.error("Failed to load files for workspace.");
      setAvailableFiles([]);
      setSelectedFiles(new Set());
      setIsAllFilesSelected(true); // Reset to all selected on error
    } finally {
      setIsLoadingFiles(false);
    }
  }, [isAllFilesSelected]);

  useEffect(() => {
    if (workspaceName) {
      fetchFiles(workspaceName);
    } else {
      setAvailableFiles([]);
      setSelectedFiles(new Set());
      setIsAllFilesSelected(true);
    }
  }, [workspaceName, fetchFiles]);

  useEffect(() => {
    // Notify parent component about changes
    const filesToPass = isAllFilesSelected ? "all" : Array.from(selectedFiles);
    onSearchSettingsChange(selectedEngine, filesToPass);
  }, [selectedEngine, selectedFiles, isAllFilesSelected, onSearchSettingsChange]);

  const handleEngineChange = (value: SearchEngineType) => {
    setSelectedEngine(value);
  };

  const handleAllFilesToggle = (checked: boolean) => {
    setIsAllFilesSelected(checked);
    if (checked) {
      setSelectedFiles(new Set(availableFiles));
    } else {
      setSelectedFiles(new Set());
    }
  };

  const handleFileToggle = (fileName: string, checked: boolean) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(fileName);
      } else {
        newSet.delete(fileName);
      }
      return newSet;
    });
    setIsAllFilesSelected(false); // If individual file is toggled, "All" is no longer true
  };

  // Update "All files" checkbox state if all individual files are selected/deselected manually
  useEffect(() => {
    if (availableFiles.length > 0 && selectedFiles.size === availableFiles.length) {
      setIsAllFilesSelected(true);
    } else if (selectedFiles.size < availableFiles.length) {
      setIsAllFilesSelected(false);
    }
  }, [selectedFiles, availableFiles]);

  const isDisabled = !workspaceName;

  return (
    <div className="w-64 flex-shrink-0 bg-card border-r p-4 space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold flex items-center">
          <Search className="h-4 w-4 mr-2" /> Search Engine
        </h3>
        <Select
          value={selectedEngine}
          onValueChange={handleEngineChange}
          disabled={isDisabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select Engine" />
          </SelectTrigger>
          <SelectContent>
            {searchEngines.map((engine) => (
              <SelectItem key={engine.value} value={engine.value}>
                {engine.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div className="space-y-2">
        <h3 className="text-lg font-semibold flex items-center">
          <Files className="h-4 w-4 mr-2" /> Filter Files
        </h3>
        {isDisabled ? (
          <p className="text-muted-foreground text-sm">Select a workspace to filter files.</p>
        ) : isLoadingFiles ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : availableFiles.length === 0 ? (
          <p className="text-muted-foreground text-sm">No files found in this workspace.</p>
        ) : (
          <>
            <div className="flex items-center space-x-2 mb-2">
              <Checkbox
                id="all-files"
                checked={isAllFilesSelected}
                onCheckedChange={(checked) => handleAllFilesToggle(Boolean(checked))}
                disabled={isDisabled}
              />
              <Label htmlFor="all-files" className="text-sm font-medium cursor-pointer">
                All Files ({availableFiles.length})
              </Label>
            </div>
            <Separator />
            <ScrollArea className="h-48 pr-4">
              <div className="space-y-2">
                {availableFiles.map((file) => (
                  <div key={file} className="flex items-center space-x-2">
                    <Checkbox
                      id={`file-${file}`}
                      checked={selectedFiles.has(file)}
                      onCheckedChange={(checked) => handleFileToggle(file, Boolean(checked))}
                      disabled={isDisabled}
                    />
                    <Label
                      htmlFor={`file-${file}`}
                      className={cn(
                        "text-sm font-normal cursor-pointer max-w-[180px] truncate",
                        isDisabled && "text-muted-foreground"
                      )}
                      title={file}
                    >
                      {file}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </div>
    </div>
  );
};

export default SearchControls;