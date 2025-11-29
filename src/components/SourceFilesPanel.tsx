"use client";

import React, { useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GraphNode, GraphEdge } from "@/database/workspaceStorage";

interface SourceFilesPanelProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedSourceFiles: Set<string>;
  onSelectedSourceFilesChange: (files: Set<string>) => void;
  onClose: () => void;
  onFilterInteraction: () => void; // New prop
}

const SourceFilesPanel: React.FC<SourceFilesPanelProps> = ({
  nodes,
  edges,
  selectedSourceFiles,
  onSelectedSourceFilesChange,
  onClose,
  onFilterInteraction,
}) => {
  const uniqueSourceFiles = useMemo(() => {
    const files = new Set<string>();
    nodes.forEach(node => files.add(node.source as string));
    edges.forEach(edge => edge.source_file && files.add(edge.source_file as string));
    return Array.from(files).sort();
  }, [nodes, edges]);

  const handleSourceFileChange = (file: string, checked: boolean) => {
    onSelectedSourceFilesChange((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(file);
      } else {
        newSet.delete(file);
      }
      return newSet;
    });
    onFilterInteraction(); // Notify parent about filter interaction
  };

  const handleSelectAll = () => {
    onSelectedSourceFilesChange(new Set(uniqueSourceFiles));
    onFilterInteraction(); // Notify parent about filter interaction
  };

  const handleClearAll = () => {
    onSelectedSourceFilesChange(new Set());
    onFilterInteraction(); // Notify parent about filter interaction
  };

  return (
    <Card className="h-full bg-background/80 backdrop-blur-sm border-none shadow-lg" onClick={e => e.stopPropagation()}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center">
          <FileText className="h-5 w-5 mr-2" />
          <CardTitle className="text-xl">Source Files</CardTitle>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} title="Close Source Files Panel">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="h-[calc(100%-60px)] flex flex-col p-3 overflow-hidden"> {/* Changed p-4 to p-3 */}
        <div className="flex space-x-2 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            disabled={uniqueSourceFiles.length === 0 || selectedSourceFiles.size === uniqueSourceFiles.length}
            className="flex-1"
          >
            Select All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            disabled={selectedSourceFiles.size === 0}
            className="flex-1"
          >
            Clear All
          </Button>
        </div>
        <ScrollArea className="flex-grow pr-4 hide-scrollbar">
          <div className="grid gap-2">
            {uniqueSourceFiles.map((file) => (
              <div key={file} className="flex items-center space-x-2">
                <Checkbox
                  id={`source-file-${file}`}
                  checked={selectedSourceFiles.has(file)}
                  onCheckedChange={(checked) => handleSourceFileChange(file, checked as boolean)}
                />
                <Label htmlFor={`source-file-${file}`} className="text-sm cursor-pointer">
                  {file}
                </Label>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default SourceFilesPanel;