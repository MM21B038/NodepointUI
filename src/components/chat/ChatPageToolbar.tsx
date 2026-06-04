"use client";

import {
  EyeOff,
  FolderOpen,
  Loader2,
  MessageSquare,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import GroupScopeSelector from "@/components/scope/GroupScopeSelector";
import { GroupTagBadge } from "@/components/group/GroupTagBadge";
import type { ViewScopeMode } from "@/lib/viewScope";
import type { WorkspaceGroupSummary } from "@/database/workspaceStorage";
import { formatGroupMemberCount } from "@/lib/groupTag";
import { formatScopedResourceLabel } from "@/lib/ownerScope";
import { cn } from "@/lib/utils";

export type ChatBannerVariant = "default" | "warning" | "destructive";

export interface ChatBanner {
  message: string;
  variant?: ChatBannerVariant;
  spinning?: boolean;
}

interface ChatPageToolbarProps {
  scopeMode: ViewScopeMode;
  displayTarget: string;
  activeGroup: string | null;
  activeGroupMeta: WorkspaceGroupSummary | null;
  incognito: boolean;
  activeSessionTitle: string;
  streamActive: boolean;
  banner: ChatBanner | null;
  showRetry: boolean;
  canClear: boolean;
  onIncognitoChange: (checked: boolean) => void;
  onOpenSessions: () => void;
  onRetry: () => void;
  onClearMessages: () => void;
}

const bannerClass: Record<ChatBannerVariant, string> = {
  default: "border-border/50 bg-muted/40 text-foreground",
  warning: "border-amber-500/30 bg-amber-500/8 text-amber-950 dark:text-amber-100",
  destructive: "border-destructive/30 bg-destructive/8 text-destructive",
};

export function ChatPageToolbar({
  scopeMode,
  displayTarget,
  activeGroup,
  activeGroupMeta,
  incognito,
  activeSessionTitle,
  streamActive,
  banner,
  showRetry,
  canClear,
  onIncognitoChange,
  onOpenSessions,
  onRetry,
  onClearMessages,
}: ChatPageToolbarProps) {
  return (
    <header className="shrink-0 border-b border-border/50 bg-background px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="text-sm font-semibold tracking-tight">Chat</h1>
          {scopeMode === "group" && activeGroup ? (
            <Badge
              variant="outline"
              className="h-6 max-w-[16rem] gap-1 truncate border-border/60 px-2 text-[11px] font-normal"
            >
              <Users className="h-3 w-3 shrink-0 opacity-70" />
              <span className="truncate">
                {formatScopedResourceLabel(
                  activeGroup,
                  activeGroupMeta?.owner_username,
                  { forceOwner: Boolean(activeGroupMeta?.owner_username) }
                )}
              </span>
              {activeGroupMeta ? (
                <>
                  <span className="text-muted-foreground">·</span>
                  <GroupTagBadge
                    tag={activeGroupMeta.tag}
                    size="xs"
                    className="normal-case"
                  />
                  <span className="hidden text-muted-foreground sm:inline">
                    · {formatGroupMemberCount(activeGroupMeta)}
                  </span>
                </>
              ) : null}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="h-6 max-w-[12rem] gap-1 truncate border-border/60 px-2 text-[11px] font-normal"
            >
              <FolderOpen className="h-3 w-3 shrink-0 opacity-70" />
              <span className="truncate">{displayTarget}</span>
            </Badge>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-center">
          <GroupScopeSelector disabled={streamActive} />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {!incognito && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 max-w-[9rem] gap-1.5 px-2 text-xs font-normal"
                  disabled={streamActive}
                  onClick={onOpenSessions}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {activeSessionTitle || "Sessions"}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Saved conversations</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex h-8 items-center gap-1.5 rounded-md border border-border/50 px-2">
                <Switch
                  id="chat-incognito"
                  checked={incognito}
                  onCheckedChange={onIncognitoChange}
                  disabled={streamActive}
                  className="scale-90"
                />
                <Label
                  htmlFor="chat-incognito"
                  className="cursor-pointer text-[11px] font-normal text-muted-foreground"
                >
                  <EyeOff className="mr-0.5 inline h-3 w-3" />
                  Private
                </Label>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Incognito — messages are not saved
            </TooltipContent>
          </Tooltip>

          {showRetry ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onRetry}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Retry load</TooltipContent>
            </Tooltip>
          ) : null}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onClearMessages}
                disabled={!canClear}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Clear messages</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {banner ? (
        <div
          className={cn(
            "mt-2 flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs",
            bannerClass[banner.variant ?? "default"]
          )}
          role="status"
        >
          {banner.spinning ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
          ) : null}
          <span className="min-w-0 truncate">{banner.message}</span>
        </div>
      ) : null}
    </header>
  );
}
