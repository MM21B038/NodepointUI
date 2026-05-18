"use client";

import React from "react";
import { GraphNode } from "@/database/workspaceStorage";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { FileText, Hash, Info, FolderCog } from "lucide-react";
import { colorScale } from "./InteractiveGraphVisualization";

interface DetailPanelProps {
  item: GraphNode | null;
  workspaceName: string | null;
}

const DetailPanel: React.FC<DetailPanelProps> = ({ item, workspaceName }) => {
  if (!item) {
    return (
      <div className="flex min-h-[12rem] flex-col items-center justify-center px-4 py-8 text-center text-muted-foreground">
        <Info className="mb-3 h-8 w-8 opacity-40" />
        <p className="text-sm">Click a node in the graph to view its details.</p>
      </div>
    );
  }

  const displayAttributes = Object.entries(item.attributes).filter(
    ([key]) => key !== "__kb_workspace"
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span
          className={cn("h-3 w-3 shrink-0 rounded-full")}
          style={{ backgroundColor: colorScale(item.type) }}
        />
        <Badge variant="secondary" className="text-xs font-medium">
          {item.type}
        </Badge>
      </div>

      {workspaceName ? (
        <section className="space-y-1.5">
          <h4 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <FolderCog className="h-3.5 w-3.5" />
            Workspace
          </h4>
          <p className="rounded-md bg-muted/50 px-3 py-2 text-sm break-all">{workspaceName}</p>
        </section>
      ) : null}

      <section className="space-y-1.5">
        <h4 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <FileText className="h-3.5 w-3.5" />
          Source {item.source.length > 1 ? "documents" : "document"}
        </h4>
        <div className="rounded-md border border-border/60 bg-muted/30 p-2">
          {item.source.length > 0 ? (
            <ul className="space-y-1.5">
              {item.source.map((src, index) => (
                <li
                  key={index}
                  className="rounded-md bg-background/80 px-2 py-1.5 text-sm break-all"
                >
                  {src}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-1 py-0.5 text-sm text-muted-foreground">No source documents.</p>
          )}
        </div>
      </section>

      <section className="space-y-1.5">
        <h4 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Hash className="h-3.5 w-3.5" />
          Attributes
        </h4>
        <div className="rounded-md border border-border/60 bg-muted/30 p-2">
          {displayAttributes.length > 0 ? (
            <dl className="space-y-2">
              {displayAttributes.map(([key, value]) => (
                <div key={key} className="text-sm">
                  <dt className="font-medium text-muted-foreground">{key}</dt>
                  <dd className="mt-0.5 break-words text-foreground">{String(value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No attributes.</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default DetailPanel;
