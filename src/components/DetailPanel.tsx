"use client";

import React from "react";
import { GraphNode } from "@/database/workspaceStorage";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CircleDot, FileText, Hash, Info, FolderCog } from "lucide-react";
import { colorScale } from "./InteractiveGraphVisualization";

interface DetailPanelProps {
  item: GraphNode | null;
  workspaceName: string | null;
}

const DetailPanel: React.FC<DetailPanelProps> = ({ item, workspaceName }) => {
  if (!item) {
    return (
      <div className="text-muted-foreground p-4 text-center">
        <Info className="h-6 w-6 mx-auto mb-2 text-muted" />
        <p>Click on a node in the graph to see its details here.</p>
      </div>
    );
  }

  const displayAttributes = Object.entries(item.attributes).filter(
    ([key]) => key !== "__kb_workspace"
  );

  return (
    <div className="p-4">
      <CardHeader className="pb-2 px-0 pt-0">
        <CardTitle className="flex items-center text-xl">
          <CircleDot className="h-5 w-5 mr-2 text-primary" />
          <span className="break-words flex-1 min-w-0">{item.label}</span>
        </CardTitle>
        <div className="flex items-center space-x-2 mt-2">
          <span
            className={cn("h-4 w-4 rounded-full")}
            style={{ backgroundColor: colorScale(item.type) }}
          />
          <Badge variant="secondary" className="text-sm font-medium">
            {item.type}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-0 pb-0">
        {workspaceName && (
          <div>
            <h5 className="font-semibold text-sm flex items-center text-muted-foreground mb-1">
              <FolderCog className="h-4 w-4 mr-1" /> Workspace
            </h5>
            <p className="bg-secondary/50 p-2 rounded-md text-sm text-foreground break-all">
              {workspaceName}
            </p>
          </div>
        )}
        <Separator />

        <div>
          <h5 className="font-semibold text-sm flex items-center text-muted-foreground mb-1">
            <FileText className="h-4 w-4 mr-1" /> Source Document
            {item.source.length > 1 ? "s" : ""}
          </h5>
          <div className="border rounded-md p-3 bg-secondary/50">
            <div className="space-y-2">
              {item.source.length > 0 ? (
                item.source.map((src, index) => (
                  <div
                    key={index}
                    className="bg-muted p-2 rounded-md text-sm text-foreground break-all"
                  >
                    {src}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No source documents.</p>
              )}
            </div>
          </div>
        </div>
        <Separator />
        <div>
          <h5 className="font-semibold text-sm flex items-center text-muted-foreground mb-1">
            <Hash className="h-4 w-4 mr-1" /> Attributes
          </h5>
          <div className="border rounded-md p-3 bg-secondary/50">
            {displayAttributes.length > 0 ? (
              <div className="grid grid-cols-1 gap-y-2">
                {displayAttributes.map(([key, value]) => (
                  <p key={key} className="flex items-baseline text-sm">
                    <span className="font-semibold text-muted-foreground mr-1">{key}:</span>
                    <span className="text-foreground break-words flex-1 min-w-0">
                      {String(value)}
                    </span>
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No specific attributes found.</p>
            )}
          </div>
        </div>
      </CardContent>
    </div>
  );
};

export default DetailPanel;
