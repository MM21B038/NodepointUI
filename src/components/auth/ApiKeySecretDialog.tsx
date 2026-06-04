"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copyTextToClipboard } from "@/lib/copyToClipboard";

interface ApiKeySecretDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  /** Full secret from create response (`key` field). */
  apiKey: string;
}

export default function ApiKeySecretDialog({
  open,
  onOpenChange,
  name,
  apiKey,
}: ApiKeySecretDialogProps) {
  const [copied, setCopied] = useState(false);
  const fullKey = apiKey;

  const handleCopy = async () => {
    await copyTextToClipboard(fullKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>API key created</DialogTitle>
          <DialogDescription>
            Copy the key for &quot;{name}&quot; now. You will not be able to see
            it again.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Input readOnly value={fullKey} className="font-mono text-xs" />
          <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy key
              </>
            )}
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
