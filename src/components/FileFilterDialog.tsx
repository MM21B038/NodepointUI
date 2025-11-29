"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface FileFilterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  availableFiles: string[];
  initialSelectedFiles: string[] | "all";
  onApplyFilter: (files: string[] | "all") => void;
}

const FileFilterDialog: React.FC<FileFilterDialogProps> = ({
  isOpen,
  onClose,
  availableFiles,
  initialSelectedFiles,
  onApplyFilter,
}) => {
  const [tempSelectedFiles, setTempSelectedFiles] = new Set<string>();
  const [showSelectionError, setShowSelectionError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Initialize tempSelectedFiles when dialog opens
      if (initialSelectedFiles === "all") {
        setTempSelectedFiles(new Set(availableFiles));
      } else {
        setTempSelectedFiles(new Set(initialSelectedFiles));
      }
      setShowSelectionError(false); // Reset error on open
    }
  }, [isOpen, availableFiles, initialSelectedFiles]);

  const handleFileChange = (fileName: string, checked: boolean) => {
    setTempSelectedFiles((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(fileName);
      } else {
        newSet.delete(fileName);
      }
      setShowSelectionError(newSet.size === 0); // Update error state immediately
      return newSet;
    });
  };

  const handleSelectAll = () => {
    setTempSelectedFiles(new Set(availableFiles));
    setShowSelectionError(false);
  };

  const handleClearAll = () => {
    setTempSelectedFiles(new Set());
    setShowSelectionError(true); // Clearing all should show error
  };

  const handleApply = () => {
    if (tempSelectedFiles.size === 0) {
      setShowSelectionError(true);
      return;
    }
    onApplyFilter(Array.from(tempSelectedFiles));
    onClose();
  };

  const handleRemoveFilter = () => {
    onApplyFilter("all");
    onClose();
  };

  const isApplyDisabled = tempSelectedFiles.size === 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[90vw]          /* takes 90% of viewport width on small screens */
          sm:w-[70vw]       /* medium screens */
          md:w-[50vw]       /* larger screens */
          lg:w-[35vw]       /* desktop */
          max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Filter Files</DialogTitle>
          <DialogDescription>
            Select which files to include in your search queries.
          </DialogDescription>
        </DialogHeader>
        <div className="py-3 space-y-4"> {/* Changed py-4 to py-3 */}
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              disabled={availableFiles.length === 0 || tempSelectedFiles.size === availableFiles.length}
              className="flex-1"
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              disabled={tempSelectedFiles.size === 0}
              className="flex-1"
            >
              Clear All
            </Button>
          </div>

          {availableFiles.length === 0 ? (
            <p className="text-center text-muted-foreground">
              No files available in this workspace.
            </p>
          ) : (
            <ScrollArea className="h-48 w-full rounded-md border p-4 hide-scrollbar">
              <div className="grid gap-2">
                {availableFiles.map((file) => (
                  <div key={file} className="flex items-center space-x-2">
                    <Checkbox
                      id={`file-filter-${file}`}
                      checked={tempSelectedFiles.has(file)}
                      onCheckedChange={(checked) => handleFileChange(file, checked as boolean)}
                    />
                    <Label htmlFor={`file-filter-${file}`} className="text-sm cursor-pointer">
                      {file}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {showSelectionError && (
            <Alert variant="destructive">
              <Info className="h-4 w-4" />
              <AlertTitle>Selection Required</AlertTitle>
              <AlertDescription>
                Please select at least one file to apply the filter.
              </AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleRemoveFilter}>
            Remove Filter
          </Button>
          <Button onClick={handleApply} disabled={isApplyDisabled}>
            Apply Filter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FileFilterDialog;