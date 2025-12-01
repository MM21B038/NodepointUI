"use client";

import React from "react";
import { GraphNode, GraphEdge } from "@/database/workspaceStorage";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CircleDot, Link, FileText, Hash, Info, FolderCog } from "lucide-react";

// --- Color Mapping for React Components (DetailPanel & Filters) ---
// This is kept simple for Tailwind classes in the React UI
const TYPE_COLORS: Record<string, string> = {
  'Person': 'bg-blue-500',
  'Organization': 'bg-green-500',
  'Concept': 'bg-purple-500',
  'Date': 'bg-yellow-500',
  'Location': 'bg-red-500',
  'default': 'bg-gray-400',
};

export const getNodeColorClass = (type: string) => TYPE_COLORS[type] || TYPE_COLORS['default'];

interface DetailPanelProps {
  item: GraphNode | GraphEdge | null;
  workspaceName: string | null; // New prop for workspace name
}

const DetailPanel: React.FC<DetailPanelProps> = ({ item, workspaceName }) => {
  if (!item) {
    return (
      <div className="text-muted-foreground p-4 text-center">
        <Info className="h-6 w-6 mx-auto mb-2 text-muted" />
        <p>Click on a node or edge in the graph to see its details here.</p>
      </div>
    );
  }

  if ('type' in item) {
    // Node details
    return (
      <div className="p-4">
        <CardHeader className="pb-2 px-0 pt-0">
          <CardTitle className="flex items-center text-xl">
            <CircleDot className="h-5 w-5 mr-2 text-primary" />
            <span className="break-words flex-1 min-w-0">{item.label}</span>
          </CardTitle>
          <div className="flex items-center space-x-2 mt-2">
            <span className={cn("h-4 w-4 rounded-full", getNodeColorClass(item.type))}></span>
            <Badge variant="secondary" className="text-sm font-medium">{item.type}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-0 pb-0">
          {/* New: Workspace Name */}
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

          {/* Existing: Source Documents */}
          <div>
            <h5 className="font-semibold text-sm flex items-center text-muted-foreground mb-1">
              <FileText className="h-4 w-4 mr-1" /> Source Document{item.source.length > 1 ? 's' : ''}
            </h5>
            <div className="border rounded-md p-3 bg-secondary/50"> {/* Outer box */}
              <div className="space-y-2"> {/* Added space-y-2 for spacing between source boxes */}
                {item.source.length > 0 ? (
                  item.source.map((src, index) => (
                    <div key={index} className="bg-muted p-2 rounded-md text-sm text-foreground break-all">
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
              {Object.keys(item.attributes).length > 0 ? (
                <div className="grid grid-cols-1 gap-y-2">
                  {Object.entries(item.attributes).map(([key, value]) => (
                    <div key={key} className="flex flex-col">
                      <span className="font-semibold text-sm text-muted-foreground">{key}:</span> 
                      <span className="text-foreground text-sm break-words">{String(value)}</span>
                    </div>
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
  } else {
    // Edge details
    return (
      <div className="p-4">
        <CardHeader className="pb-2 px-0 pt-0">
          <CardTitle className="flex items-center text-xl">
            <Link className="h-5 w-5 mr-2 text-primary" />
            Relationship
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-0 pb-0">
          <div>
            <h5 className="font-semibold text-sm flex items-center text-muted-foreground mb-1">
              <Info className="h-4 w-4 mr-1" /> Relationship Path
            </h5>
            <p className="text-sm break-words bg-secondary/50 p-2 rounded-md">
              <span className="font-medium text-primary">{item.source}</span> 
              <span className="text-muted-foreground mx-2">--({item.label})--&gt;</span> 
              <span className="font-medium text-primary">{item.target}</span>
            </p>
          </div>
          <Separator />
          <div className="space-y-2 text-sm">
            <div>
              <h5 className="font-semibold text-sm flex items-center text-muted-foreground mb-1">
                <Hash className="h-4 w-4 mr-1" /> Type
              </h5>
              <p className="bg-secondary/50 p-2 rounded-md break-words">{item.label}</p>
            </div>
            <div>
              <h5 className="font-semibold text-sm flex items-center text-muted-foreground mb-1">
                <Info className="h-4 w-4 mr-1" /> Score/Weight
              </h5>
              <p className="bg-secondary/50 p-2 rounded-md">{item.score.toFixed(2)}</p>
            </div>
            <div>
              <h5 className="font-semibold text-sm flex items-center text-muted-foreground mb-1">
                <FileText className="h-4 w-4 mr-1" /> Source Document{item.source_file.length > 1 ? 's' : ''}
              </h5>
              <div className="border rounded-md p-3 bg-secondary/50"> {/* Outer box */}
                <div className="space-y-2"> {/* Added space-y-2 for spacing between source boxes */}
                  {item.source_file.length > 0 ? (
                    item.source_file.map((src, index) => (
                      <div key={index} className="bg-muted p-2 rounded-md text-sm text-foreground break-all">
                        {src}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No source documents.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </div>
    );
  }
};

export default DetailPanel;