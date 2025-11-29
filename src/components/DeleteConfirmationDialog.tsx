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
import { cn } from "@/lib/utils"; // Import cn for utility classes

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  itemName: string;
}

const CONFIRMATION_TEXT = "DELETE";

const DeleteConfirmationDialog: React.FC<DeleteConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  itemName,
}) => {
  const [confirmationInput, setConfirmationInput] = useState("");
  const isConfirmationValid = confirmationInput === CONFIRMATION_TEXT;

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
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-red-600">{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground max-w-full break-words">
            To confirm deletion of <span className="font-semibold text-foreground">{itemName}</span>, please type <code className="font-mono text-red-600">{CONFIRMATION_TEXT}</code> below.
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
        <AlertDialogFooter>
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
              I understand, Delete {itemName}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteConfirmationDialog;