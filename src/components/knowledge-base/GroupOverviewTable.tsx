"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { GroupWorkspaceEntitySummary } from "@/database/workspaceStorage";
import { cn } from "@/lib/utils";

interface GroupOverviewTableProps {
  rows: GroupWorkspaceEntitySummary[];
  selectedWorkspace?: string | null;
  onSelectWorkspace: (workspace: string) => void;
  className?: string;
}

export default function GroupOverviewTable({
  rows,
  selectedWorkspace = null,
  onSelectWorkspace,
  className,
}: GroupOverviewTableProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = [...rows].sort((a, b) => a.workspace.localeCompare(b.workspace));
    if (!q) return base;
    return base.filter((r) => r.workspace.toLowerCase().includes(q));
  }, [rows, query]);

  const topTypes = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of rows) {
      for (const et of row.entityTypes.slice(0, 5)) {
        totals.set(et.type, (totals.get(et.type) ?? 0) + et.count);
      }
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([type]) => type);
  }, [rows]);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-2", className)}>
      <div className="relative shrink-0">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${rows.length} workspaces…`}
          className="h-8 pl-8 text-sm"
        />
      </div>
      <ScrollArea className="min-h-0 flex-1 rounded-md border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm">
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Workspace</th>
              <th className="px-3 py-2 font-medium text-right">Entities</th>
              {topTypes.map((type) => (
                <th key={type} className="hidden px-2 py-2 font-medium text-right sm:table-cell">
                  {type}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={2 + topTypes.length}
                  className="px-3 py-8 text-center text-xs text-muted-foreground"
                >
                  No workspaces match search.
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const typeMap = new Map(row.entityTypes.map((et) => [et.type, et.count]));
                const isSelected = selectedWorkspace === row.workspace;
                return (
                  <tr
                    key={row.workspace}
                    className={cn(
                      "cursor-pointer border-b border-border/40 transition-colors hover:bg-muted/50",
                      isSelected && "bg-primary/10"
                    )}
                    onClick={() => onSelectWorkspace(row.workspace)}
                  >
                    <td className="max-w-[200px] truncate px-3 py-2 font-medium" title={row.workspace}>
                      {row.workspace}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {row.totalEntities}
                    </td>
                    {topTypes.map((type) => (
                      <td
                        key={type}
                        className="hidden px-2 py-2 text-right tabular-nums text-muted-foreground sm:table-cell"
                      >
                        {typeMap.get(type) ?? "—"}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </ScrollArea>
      <p className="shrink-0 text-xs text-muted-foreground">
        Click a row to load that workspace in the graph (single workspace, full node budget).
      </p>
    </div>
  );
}
