"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Import Select components

// Helper function to parse workspace names with new patterns
const parseWorkspaceNames = (input: string): string[] => {
  const parts = input.split(',').map(p => p.trim()).filter(Boolean);
  const parsedNames: string[] = [];

  for (const part of parts) {
    // Handle ranges like AS423-453
    const rangeMatch = part.match(/^([a-zA-Z_]+)(\d+)-(\d+)$/);
    if (rangeMatch) {
      const prefix = rangeMatch[1];
      const startNum = parseInt(rangeMatch[2], 10);
      const endNum = parseInt(rangeMatch[3], 10);

      if (!isNaN(startNum) && !isNaN(endNum) && startNum <= endNum) {
        for (let i = startNum; i <= endNum; i++) {
          parsedNames.push(`${prefix}${i}`);
        }
        continue;
      }
    }

    // Handle "starts with" pattern: AS2$
    if (part.endsWith('$') && part.length > 1) {
      parsedNames.push(`(Starts with: ${part.slice(0, -1)})`);
      continue;
    }

    // Handle "ends with" pattern: $Project
    if (part.startsWith('$') && part.length > 1) {
      parsedNames.push(`(Ends with: ${part.slice(1)})`);
      continue;
    }

    // Exact match
    parsedNames.push(part);
  }
  return parsedNames;
};

interface BatchFlaggingControlsProps {
  // Removed activeMethod prop as it's now managed internally
}

const BatchFlaggingControls: React.FC<BatchFlaggingControlsProps> = () => {
  const [selectedBatchMethod, setSelectedBatchMethod] = useState<'names' | 'time'>('names'); // Internal state
  const [namesInput, setNamesInput] = useState("");
  const [beforeDate, setBeforeDate] = useState<string>("");
  const [afterDate, setAfterDate] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  const parsedNames = useMemo(() => parseWorkspaceNames(namesInput), [namesInput]);

  // Placeholder function to demonstrate interaction, will be replaced with actual API calls
  const handleBatchAction = (actionType: string, criteria: any) => {
    setIsProcessing(true);
    const loadingToastId = toast.loading(`Attempting to ${actionType} workspaces... (Backend API needed)`);
    setTimeout(() => {
      toast.info(`Backend API for batch ${actionType} is not yet implemented. Parsed criteria: ${JSON.stringify(criteria)}`, { id: loadingToastId, duration: 5000 });
      setIsProcessing(false);
    }, 2000);
    console.log(`Attempting to ${actionType} with criteria:`, criteria);
  };

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold flex items-center text-primary">
        <Flag className="h-5 w-5 mr-2" /> Batch Flagging
      </h2>
      <Select value={selectedBatchMethod} onValueChange={(value: 'names' | 'time') => setSelectedBatchMethod(value)}>
        <SelectTrigger className="w-full"> {/* Changed width to full */}
          <SelectValue placeholder="Select Method" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="names">By Name Sequences</SelectItem>
          <SelectItem value="time">By Creation Time</SelectItem>
        </SelectContent>
      </Select>

      {selectedBatchMethod === 'names' && (
        <div className="space-y-3">
          <Label htmlFor="names-input">Workspace Names (comma-separated)</Label>
          <Input
            id="names-input"
            placeholder="e.g., ProjectA, AS2$, $Project, AS423-453"
            value={namesInput}
            onChange={(e) => setNamesInput(e.target.value)}
            disabled={isProcessing}
          />
          <div className="flex gap-2">
            <Button
              onClick={() => handleBatchAction("flag by names", { names: parsedNames })}
              disabled={isProcessing || !namesInput.trim()}
              className="flex-1"
              size="icon"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4 text-green-600" />}
              <span className="sr-only">Flag Names</span>
            </Button>
            <Button
              onClick={() => handleBatchAction("unflag by names", { names: parsedNames })}
              disabled={isProcessing || !namesInput.trim()}
              variant="outline"
              className="flex-1"
              size="icon"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4 text-red-600" />}
              <span className="sr-only">Unflag Names</span>
            </Button>
          </div>
        </div>
      )}

      {selectedBatchMethod === 'time' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="after-date">Created After (YYYY-MM-DD)</Label>
              <Input
                id="after-date"
                type="text"
                placeholder="e.g., 2023-01-01"
                value={afterDate}
                onChange={(e) => setAfterDate(e.target.value)}
                disabled={isProcessing}
              />
            </div>
            <div>
              <Label htmlFor="before-date">Created Before (YYYY-MM-DD)</Label>
              <Input
                id="before-date"
                type="text"
                placeholder="e.g., 2023-12-31"
                value={beforeDate}
                onChange={(e) => setBeforeDate(e.target.value)}
                disabled={isProcessing}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => handleBatchAction("flag by date", { after: afterDate, before: beforeDate })}
              disabled={isProcessing || (!afterDate && !beforeDate)}
              className="flex-1"
              size="icon"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4 text-green-600" />}
              <span className="sr-only">Flag by Date</span>
            </Button>
            <Button
              onClick={() => handleBatchAction("unflag by date", { after: afterDate, before: beforeDate })}
              disabled={isProcessing || (!afterDate && !beforeDate)}
              variant="outline"
              className="flex-1"
              size="icon"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4 text-red-600" />}
              <span className="sr-only">Unflag by Date</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchFlaggingControls;