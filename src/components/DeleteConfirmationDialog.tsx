"use client";

import React, { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  itemName?: string;
  itemNames?: string[];
}

const CONFIRMATION_TEXT = "DELETE";

function resolveItemLabel(itemName?: string, itemNames?: string[]): string {
  if (itemNames && itemNames.length > 0) {
    return itemNames.length === 1 ? itemNames[0] : `${itemNames.length} items`;
  }
  return itemName ?? "this item";
}

const DeleteConfirmationDialog: React.FC<DeleteConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  itemName,
  itemNames,
}) => {
  const [confirmationInput, setConfirmationInput] = useState("");
  const isConfirmationValid = confirmationInput === CONFIRMATION_TEXT;
  const resolvedNames =
    itemNames && itemNames.length > 0 ? itemNames : itemName ? [itemName] : [];
  const confirmLabel = resolveItemLabel(itemName, itemNames);
  const isBulk = resolvedNames.length > 1;

  const handleConfirm = () => {
    if (isConfirmationValid) {
      onConfirm();
      setConfirmationInput("");
    }
  };

  const handleClose = () => {
    setConfirmationInput("");
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleClose}>
      <AlertDialogContent
        className={cn(
          "w-[calc(100%-2rem)] max-w-md overflow-hidden",
          "bg-card/50 backdrop-blur-sm",
          "border-t-4 border-b-4 border-destructive",
          "border-x-0",
        )}
      >
        <AlertDialogHeader className="min-w-0 space-y-2 text-left">
          <AlertDialogTitle className="break-words text-red-600 line-clamp-3">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="max-h-32 overflow-y-auto break-words text-left [overflow-wrap:anywhere]">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isBulk && (
          <ScrollArea className="max-h-32 rounded-md border bg-muted/30">
            <ul className="divide-y p-2">
              {resolvedNames.map((name) => (
                <li
                  key={name}
                  className="truncate px-1 py-1.5 text-sm text-foreground"
                  title={name}
                >
                  {name}
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}

        <div className="min-w-0 space-y-4">
          <p className="text-sm text-muted-foreground break-words [overflow-wrap:anywhere]">
            To confirm deletion of{" "}
            {!isBulk && resolvedNames.length === 1 ? (
              <span
                className="font-semibold text-foreground inline-block max-w-full truncate align-bottom"
                title={resolvedNames[0]}
              >
                {resolvedNames[0]}
              </span>
            ) : (
              <span className="font-semibold text-foreground">{confirmLabel}</span>
            )}
            , please type{" "}
            <code className="font-mono text-red-600">{CONFIRMATION_TEXT}</code> below.
          </p>
          <div>
            <Label htmlFor="delete-confirm" className="sr-only">
              Type DELETE to confirm
            </Label>
            <Input
              id="delete-confirm"
              placeholder={CONFIRMATION_TEXT}
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              className="font-mono"
            />
          </div>
        </div>
        <AlertDialogFooter className="w-full flex-wrap gap-2 sm:gap-0">
          <AlertDialogCancel asChild>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={!isConfirmationValid}
            >
              I understand, Delete
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteConfirmationDialog;
