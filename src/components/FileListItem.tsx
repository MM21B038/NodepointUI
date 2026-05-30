"use client";

import React, { useState } from "react";
import { FileText, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { deleteFile } from "@/database/workspaceStorage";
import DeleteConfirmationDialog from "./DeleteConfirmationDialog";

interface FileListItemProps {
  fileName: string;
  workspaceName: string;
  onDeleteSuccess: () => void;
}

const FileListItem: React.FC<FileListItemProps> = ({
  fileName,
  workspaceName,
  onDeleteSuccess,
}) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    const loadingToastId = toast.loading(`Deleting file ${fileName}...`);

    try {
      await deleteFile(workspaceName, fileName);
      toast.success(`${fileName} deleted successfully.`, { id: loadingToastId });
      onDeleteSuccess();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error during deletion.";
      toast.error(`Deletion failed: ${errorMessage}`, { id: loadingToastId });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  return (
    <>
      <li className="flex items-center justify-between p-2 border rounded-md bg-secondary/50 transition-colors hover:bg-secondary">
        <div className="flex items-center">
          <FileText className="h-4 w-4 mr-3 text-primary" />
          <span>{fileName}</span>
        </div>
        <div className="flex items-center space-x-2">
          {/* Removed Start Preprocess Button */}
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => setIsDeleteDialogOpen(true)}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </li>

      <DeleteConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Delete File"
        description={`Are you sure you want to permanently delete the file "${fileName}" from workspace "${workspaceName}"? This action cannot be undone.`}
        itemName={fileName}
      />
    </>
  );
};

export default FileListItem;