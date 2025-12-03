"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface BatchFlaggingControlsProps {
  activeMethod: 'names' | 'time';
}

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

const BatchFlaggingControls: React.FC<BatchFlaggingControlsProps> = ({ activeMethod }) => {
  const [namesInput, setNamesInput] = useState("");
  const [beforeDate, setBeforeDate] = useState("");
  const [afterDate, setAfterDate] = useState("");
  const [isProcessing, setIsProcessing] = useState(false); // Simulate processing state

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
    <div className="space-y-6">
      {activeMethod === 'names' && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center">
            <Flag className="h-4 w-4 mr-2 text-muted-foreground" /> By Name Sequences
          </h3>
          <Label htmlFor="names-input">Workspace Names (comma-separated)</Label>
          <Input
            id="names-input"
            placeholder="e.g., ProjectA, AS2$, $Project, AS423-453"
            value={namesInput}
            onChange={(e) => setNamesInput(e.target.value)}
            disabled={true} // Disabled until backend API is ready
          />
          <div className="flex gap-2">
            <Button
              onClick={() => handleBatchAction("flag by names", { names: parsedNames })}
              disabled={true} // Disabled until backend API is ready
              className="flex-1"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Flag className="h-4 w-4 mr-2" />}
              Flag Names
            </Button>
            <Button
              onClick={() => handleBatchAction("unflag by names", { names: parsedNames })}
              disabled={true} // Disabled until backend API is ready
              variant="outline"
              className="flex-1"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Flag className="h-4 w-4 mr-2" />}
              Unflag Names
            </Button>
          </div>
        </div>
      )}

      {activeMethod === 'time' && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center">
            <Flag className="h-4 w-4 mr-2 text-muted-foreground" /> By Creation Time
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="after-date">Created After</Label>
              <Input
                id="after-date"
                type="date"
                value={afterDate}
                onChange={(e) => setAfterDate(e.target.value)}
                disabled={true} // Disabled until backend API is ready
              />
            </div>
            <div>
              <Label htmlFor="before-date">Created Before</Label>
              <Input
                id="before-date"
                type="date"
                value={beforeDate}
                onChange={(e) => setBeforeDate(e.target.value)}
                disabled={true} // Disabled until backend API is ready
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => handleBatchAction("flag by date", { after: afterDate, before: beforeDate })}
              disabled={true} // Disabled until backend API is ready
              className="flex-1"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Flag className="h-4 w-4 mr-2" />}
              Flag by Date
            </Button>
            <Button
              onClick={() => handleBatchAction("unflag by date", { after: afterDate, before: beforeDate })}
              disabled={true} // Disabled until backend API is ready
              variant="outline"
              className="flex-1"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Flag className="h-4 w-4 mr-2" />}
              Unflag by Date
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchFlaggingControls;