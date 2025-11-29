"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface OpenWorkspaceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  existingWorkspaces: string[];
  onSelect: (workspaceName: string) => void;
  currentWorkspace: string | null;
}

const OpenWorkspaceDialog: React.FC<OpenWorkspaceDialogProps> = ({
  isOpen,
  onClose,
  existingWorkspaces,
  onSelect,
  currentWorkspace,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Open Existing Workspace</DialogTitle>
          <DialogDescription>
            Select a workspace from the list below to open it.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {existingWorkspaces.length === 0 ? (
            <p className="text-center text-muted-foreground">
              No existing workspaces found. Create one first!
            </p>
          ) : (
            <ScrollArea className="h-48 w-full rounded-md border p-4">
              <div className="space-y-2">
                {existingWorkspaces.map((workspace) => (
                  <div
                    key={workspace}
                    onClick={() => onSelect(workspace)}
                    className={cn(
                      "p-2 rounded-md cursor-pointer transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      currentWorkspace === workspace
                        ? "bg-primary text-primary-foreground font-medium"
                        : "bg-background",
                    )}
                  >
                    {workspace}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OpenWorkspaceDialog;