"use client";

import React, { useEffect, useState } from "react";
import {
  fetchGraphEntityRecord,
  type GraphEntityRecord,
  type GraphNode,
} from "@/database/workspaceStorage";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { FileText, Hash, Info, FolderCog, Loader2 } from "lucide-react";
import { colorScale } from "./InteractiveGraphVisualization";

interface DetailPanelProps {
  item: GraphNode | null;
  workspaceName: string | null;
}

const DetailPanel: React.FC<DetailPanelProps> = ({ item, workspaceName }) => {
  const [record, setRecord] = useState<GraphEntityRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item) {
      setRecord(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setRecord(null);

    void fetchGraphEntityRecord(item.id, workspaceName)
      .then((data) => {
        if (!cancelled) setRecord(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load entity");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [item, workspaceName]);

  if (!item) {
    return (
      <div className="flex min-h-[12rem] flex-col items-center justify-center px-4 py-8 text-center text-muted-foreground">
        <Info className="mb-3 h-8 w-8 opacity-40" />
        <p className="text-sm">Click a node in the graph to view its details.</p>
      </div>
    );
  }

  const displayWorkspace = workspaceName ?? record?.workspace ?? null;
  const fileName = record?.file_name;
  const attributeEntries = record?.attributes
    ? Object.entries(record.attributes).filter(([key]) => key !== "__kb_workspace")
    : [];

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-base font-semibold leading-snug break-words">{item.label}</p>
        <div className="flex items-center gap-2">
          <span
            className={cn("h-3 w-3 shrink-0 rounded-full")}
            style={{ backgroundColor: colorScale(item.type) }}
          />
          <Badge variant="secondary" className="text-xs font-medium">
            {item.type}
          </Badge>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading entity…
        </div>
      )}

      {error && !loading && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {displayWorkspace ? (
        <section className="space-y-1.5">
          <h4 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <FolderCog className="h-3.5 w-3.5" />
            Workspace
          </h4>
          <p className="rounded-md bg-muted/50 px-3 py-2 text-sm break-all">{displayWorkspace}</p>
        </section>
      ) : null}

      {!loading && fileName ? (
        <section className="space-y-1.5">
          <h4 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            Source document
          </h4>
          <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm break-all">
            {fileName}
          </p>
        </section>
      ) : null}

      {!loading && attributeEntries.length > 0 ? (
        <section className="space-y-1.5">
          <h4 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Hash className="h-3.5 w-3.5" />
            Attributes
          </h4>
          <div className="rounded-md border border-border/60 bg-muted/30 p-2">
            <dl className="space-y-2">
              {attributeEntries.map(([key, value]) => (
                <div key={key} className="text-sm">
                  <dt className="font-medium text-muted-foreground">{key}</dt>
                  <dd className="mt-0.5 break-words text-foreground">{String(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      ) : null}

      {!loading && !error && record?.id && (
        <p className="font-mono text-[10px] text-muted-foreground break-all">{record.id}</p>
      )}
    </div>
  );
};

export default DetailPanel;
