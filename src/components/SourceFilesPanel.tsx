"use client";

import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KbGraphSidePanel } from "@/components/knowledge-base/KbGraphSidePanel";

interface SourceFilesPanelProps {
  availableFiles: string[];
  selectedSourceFiles: Set<string>;
  onSelectedSourceFilesChange: (files: Set<string>) => void;
  onClose: () => void;
  loading?: boolean;
}

const SourceFilesPanel: React.FC<SourceFilesPanelProps> = ({
  availableFiles,
  selectedSourceFiles,
  onSelectedSourceFilesChange,
  onClose,
  loading,
}) => {
  const handleSourceFileChange = (file: string, checked: boolean) => {
    const next = new Set(selectedSourceFiles);
    if (checked) next.add(file);
    else next.delete(file);
    onSelectedSourceFilesChange(next);
  };

  const toolbar = (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        className="h-8 flex-1 text-xs"
        onClick={() => onSelectedSourceFilesChange(new Set(availableFiles))}
        disabled={
          loading ||
          availableFiles.length === 0 ||
          selectedSourceFiles.size === availableFiles.length
        }
      >
        Select all
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-8 flex-1 text-xs"
        onClick={() => onSelectedSourceFilesChange(new Set())}
        disabled={loading || selectedSourceFiles.size === 0}
      >
        Clear all
      </Button>
    </div>
  );

  return (
    <KbGraphSidePanel
      title="Source files"
      icon={<FileText className="h-4 w-4" />}
      onClose={onClose}
      toolbar={toolbar}
    >
      <p className="mb-3 text-xs text-muted-foreground">
        Reloads the graph with a <span className="font-medium">file_name</span> filter on the
        API. Use depth 0 for seeds from these files only; depth &gt; 0 may include neighbors
        from other documents.
      </p>
      {availableFiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents in this scope.</p>
      ) : (
        <ul className="space-y-1">
          {availableFiles.map((file) => (
            <li
              key={file}
              className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
            >
              <Checkbox
                id={`source-file-${file}`}
                checked={selectedSourceFiles.has(file)}
                disabled={loading}
                onCheckedChange={(checked) =>
                  handleSourceFileChange(file, checked === true)
                }
                className="mt-0.5"
              />
              <Label
                htmlFor={`source-file-${file}`}
                className="min-w-0 flex-1 cursor-pointer text-sm font-normal leading-snug"
                title={file}
              >
                <span className="block truncate">{file}</span>
              </Label>
            </li>
          ))}
        </ul>
      )}
    </KbGraphSidePanel>
  );
};

export default SourceFilesPanel;
