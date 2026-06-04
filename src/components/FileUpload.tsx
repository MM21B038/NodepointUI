"use client";

import React, { useCallback, useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { uploadFiles } from "@/database/workspaceStorage";
import type { OwnerParams } from "@/lib/ownerScope";
import { cn } from "@/lib/utils";

const ALLOWED_UPLOAD_EXTENSIONS = [".txt", ".md"] as const;
const UPLOAD_ACCEPT =
  ".txt,.md,text/plain,text/markdown,application/markdown";

function isAllowedUploadFile(file: File): boolean {
  const ext = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
  return (ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(ext);
}

interface FileUploadProps {
  workspaceName: string | null;
  owner?: OwnerParams;
  onUploadSuccess: () => void;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  showLabel?: boolean;
  enableDragDrop?: boolean;
  className?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
  workspaceName,
  owner,
  onUploadSuccess,
  variant = "default",
  size = "default",
  showLabel = true,
  enableDragDrop = false,
  className,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragDepthRef = useRef(0);

  const resetInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadSelectedFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      const allowed = files.filter(isAllowedUploadFile);
      const rejected = files.length - allowed.length;

      if (allowed.length === 0) {
        toast.error("Unsupported file type. Only .txt and .md files are allowed.");
        resetInput();
        return;
      }

      if (rejected > 0) {
        toast.warning(
          `${rejected} file${rejected === 1 ? "" : "s"} skipped — only .txt and .md are allowed.`
        );
      }

      if (!workspaceName) {
        toast.error("Please select a workspace before uploading files.");
        resetInput();
        return;
      }

      setIsUploading(true);
      const loadingToastId = toast.loading(
        allowed.length === 1
          ? `Uploading ${allowed[0].name} to ${workspaceName}...`
          : `Uploading ${allowed.length} files to ${workspaceName}...`
      );

      try {
        const result = await uploadFiles(workspaceName, allowed, owner);
        if (result.failed.length === 0) {
          const replacedNote =
            result.replaced.length > 0
              ? ` (${result.replaced.length} replaced existing file${result.replaced.length === 1 ? "" : "s"})`
              : "";
          toast.success(
            allowed.length === 1
              ? `${allowed[0].name} uploaded successfully!${replacedNote}`
              : `${result.succeeded.length} files uploaded successfully!${replacedNote}`,
            { id: loadingToastId }
          );
        } else if (result.succeeded.length === 0) {
          toast.error(`Upload failed: ${result.failed[0]?.error ?? "Unknown error"}`, {
            id: loadingToastId,
          });
        } else {
          toast.warning(
            `${result.succeeded.length} uploaded, ${result.failed.length} failed.`,
            { id: loadingToastId }
          );
        }
        if (result.succeeded.length > 0) {
          onUploadSuccess();
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error during upload.";
        toast.error(`Upload failed: ${errorMessage}`, { id: loadingToastId });
      } finally {
        setIsUploading(false);
        resetInput();
      }
    },
    [workspaceName, owner, onUploadSuccess]
  );

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    await uploadSelectedFiles(files);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleDragEnter = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragging(false);
    if (isUploading || !workspaceName) return;
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      await uploadSelectedFiles(files);
    }
  };

  const isDisabled = isUploading || !workspaceName;

  const content = (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={UPLOAD_ACCEPT}
        multiple
        className="hidden"
        disabled={isDisabled}
      />
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={isDisabled}
        title={isUploading ? "Uploading…" : "Upload .txt or .md files"}
        className={showLabel ? "gap-2" : undefined}
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {showLabel && (
          <span>{isUploading ? "Uploading…" : "Upload"}</span>
        )}
      </Button>
    </>
  );

  if (!enableDragDrop) {
    return <div className={className}>{content}</div>;
  }

  return (
    <div
      className={cn(
        "relative inline-flex rounded-md transition-colors",
        isDragging && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        className
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {content}
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md border-2 border-dashed border-primary bg-primary/10 text-xs font-medium text-primary">
          Drop files
        </div>
      )}
    </div>
  );
};

export default FileUpload;
