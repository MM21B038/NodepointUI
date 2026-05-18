"use client";

import React, { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GraphNode, GraphEdge } from "@/database/workspaceStorage";
import { KbGraphSidePanel } from "@/components/knowledge-base/KbGraphSidePanel";

interface SourceFilesPanelProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedSourceFiles: Set<string>;
  onSelectedSourceFilesChange: (files: Set<string>) => void;
  onClose: () => void;
  onFilterInteraction: () => void;
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
    nodes.forEach((node) => node.source.forEach((s) => files.add(s)));
    edges.forEach((edge) => edge.source_file.forEach((s) => files.add(s)));
    return Array.from(files).sort();
  }, [nodes, edges]);

  const handleSourceFileChange = (file: string, checked: boolean) => {
    onSelectedSourceFilesChange((prev) => {
      const next = new Set(prev);
      if (checked) next.add(file);
      else next.delete(file);
      return next;
    });
    onFilterInteraction();
  };

  const toolbar = (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        className="h-8 flex-1 text-xs"
        onClick={() => {
          onSelectedSourceFilesChange(new Set(uniqueSourceFiles));
          onFilterInteraction();
        }}
        disabled={
          uniqueSourceFiles.length === 0 ||
          selectedSourceFiles.size === uniqueSourceFiles.length
        }
      >
        Select all
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-8 flex-1 text-xs"
        onClick={() => {
          onSelectedSourceFilesChange(new Set());
          onFilterInteraction();
        }}
        disabled={selectedSourceFiles.size === 0}
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
        Show nodes and edges tied to selected documents only.
      </p>
      {uniqueSourceFiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No source files in this graph.</p>
      ) : (
        <ul className="space-y-1">
          {uniqueSourceFiles.map((file) => (
            <li
              key={file}
              className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
            >
              <Checkbox
                id={`source-file-${file}`}
                checked={selectedSourceFiles.has(file)}
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
