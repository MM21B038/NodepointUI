"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Flag, Loader2, CalendarIcon } from "lucide-react"; // Added CalendarIcon
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar"; // Added Calendar
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // Added Popover components
import { format } from "date-fns"; // Added format from date-fns

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
  const [beforeDate, setBeforeDate] = useState<string>("");
  const [afterDate, setAfterDate] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  // State for calendar popovers
  const [isAfterDatePopoverOpen, setIsAfterDatePopoverOpen] = useState(false);
  const [isBeforeDatePopoverOpen, setIsBeforeDatePopoverOpen] = useState(false);

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
            By Name Sequences
          </h3>
          <Label htmlFor="names-input">Workspace Names (comma-separated)</Label>
          <Input
            id="names-input"
            placeholder="e.g., ProjectA, AS2$, $Project, AS423-453"
            value={namesInput}
            onChange={(e) => setNamesInput(e.target.value)}
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

      {activeMethod === 'time' && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center">
            By Creation Time
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="after-date">Created After</Label>
              <Popover open={isAfterDatePopoverOpen} onOpenChange={setIsAfterDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !afterDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {afterDate ? format(new Date(afterDate), "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={afterDate ? new Date(afterDate) : undefined}
                    onSelect={(date) => {
                      setAfterDate(date ? format(date, "yyyy-MM-dd") : "");
                      setIsAfterDatePopoverOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label htmlFor="before-date">Created Before</Label>
              <Popover open={isBeforeDatePopoverOpen} onOpenChange={setIsBeforeDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !beforeDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {beforeDate ? format(new Date(beforeDate), "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={beforeDate ? new Date(beforeDate) : undefined}
                    onSelect={(date) => {
                      setBeforeDate(date ? format(date, "yyyy-MM-dd") : "");
                      setIsBeforeDatePopoverOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
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