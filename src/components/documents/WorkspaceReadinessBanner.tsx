"use client";

import { Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { WorkspacePreprocessStatusResponse } from "@/database/workspaceStorage";
import { workspaceReadinessBanner } from "@/lib/preprocessUserCopy";
import { cn } from "@/lib/utils";

interface WorkspaceReadinessBannerProps {
  status: WorkspacePreprocessStatusResponse;
  className?: string;
}

export default function WorkspaceReadinessBanner({
  status,
  className,
}: WorkspaceReadinessBannerProps) {
  const ready = status.overall.ready;
  const failed = status.overall.phase === "failed" || status.overall.documents_failed > 0;

  return (
    <Alert
      className={cn(
        "border-border/60 bg-card/50 backdrop-blur-sm",
        ready && "border-green-500/25 bg-green-500/5",
        failed && !ready && "border-destructive/25 bg-destructive/5",
        !ready && !failed && "border-primary/20 bg-primary/[0.04]",
        className
      )}
    >
      <Info className="h-4 w-4" />
      <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>{workspaceReadinessBanner(status)}</span>
        {ready ? (
          <Badge className="bg-green-600 hover:bg-green-600">Ready for chat</Badge>
        ) : (
          <Badge variant="secondary">Processing</Badge>
        )}
      </AlertDescription>
    </Alert>
  );
}
