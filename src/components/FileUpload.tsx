"use client";

import React, { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { uploadFile } from "@/database/workspaceStorage";

interface FileUploadProps {
  workspaceName: string | null;
  onUploadSuccess: () => void;
  accept?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  showLabel?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({
  workspaceName,
  onUploadSuccess,
  accept = ".md,.txt,.text",
  variant = "default",
  size = "default",
  showLabel = true,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedExtensions = accept.split(",").map((ext) => ext.trim().toLowerCase());
    const fileExtension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
    if (!allowedExtensions.includes(fileExtension)) {
      toast.error(`Unsupported file type. Allowed: ${allowedExtensions.join(", ")}`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (!workspaceName) {
      toast.error("Please select a workspace before uploading files.");
      // Reset file input value to allow re-selection of the same file if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setIsUploading(true);
    const loadingToastId = toast.loading(`Uploading ${file.name} to ${workspaceName}...`);

    try {
      await uploadFile(workspaceName, file);
      toast.success(`${file.name} uploaded successfully!`, { id: loadingToastId });
      onUploadSuccess();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error during upload.";
      toast.error(`Upload failed: ${errorMessage}`, { id: loadingToastId });
    } finally {
      setIsUploading(false);
      // Reset file input value
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const isDisabled = isUploading || !workspaceName;

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={accept}
        className="hidden"
        disabled={isDisabled}
      />
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={isDisabled}
        title={isUploading ? "Uploading…" : "Upload document"}
        className={showLabel ? "gap-2" : undefined}
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {showLabel && <span>{isUploading ? "Uploading…" : "Upload"}</span>}
      </Button>
    </>
  );
};

export default FileUpload;