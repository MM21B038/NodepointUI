"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Flag, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface BatchFlaggingControlsProps {
  // This component will primarily be for UI and explaining the backend need.
  // Actual flagging functions will be integrated once backend APIs are available.
}

const BatchFlaggingControls: React.FC<BatchFlaggingControlsProps> = () => {
  const [namesInput, setNamesInput] = useState("");
  const [beforeDate, setBeforeDate] = useState("");
  const [afterDate, setAfterDate] = useState("");
  const [isProcessing, setIsProcessing] = useState(false); // Simulate processing state

  // Placeholder function to demonstrate interaction, will be replaced with actual API calls
  const handleBatchAction = (actionType: string, criteria: any) => {
    setIsProcessing(true);
    const loadingToastId = toast.loading(`Attempting to ${actionType} workspaces... (Backend API needed)`);
    setTimeout(() => {
      toast.info(`Backend API for batch ${actionType} is not yet implemented.`, { id: loadingToastId });
      setIsProcessing(false);
    }, 2000);
    console.log(`Attempting to ${actionType} with criteria:`, criteria);
  };

  return (
    <div className="space-y-6">
      {/* Removed: Alert for Backend API Required */}

      {/* Flag/Unflag All Workspaces */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center">
          <Flag className="h-4 w-4 mr-2 text-muted-foreground" /> All Workspaces
        </h3>
        <div className="flex gap-2">
          {/* Removed: Flag All Button */}
          <Button
            onClick={() => handleBatchAction("unflag all", {})}
            disabled={true} // Disabled until backend API is ready
            variant="outline"
            className="flex-1"
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Flag className="h-4 w-4 mr-2" />}
            Unflag All
          </Button>
        </div>
      </div>

      <Separator />

      {/* Flag/Unflag by Name Sequences */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center">
          <Flag className="h-4 w-4 mr-2 text-muted-foreground" /> By Name Sequences
        </h3>
        <Label htmlFor="names-input">Workspace Names (comma-separated)</Label>
        <Input
          id="names-input"
          placeholder="e.g., ProjectA, Test_Workspace, MyDoc"
          value={namesInput}
          onChange={(e) => setNamesInput(e.target.value)}
          disabled={true} // Disabled until backend API is ready
        />
        <div className="flex gap-2">
          <Button
            onClick={() => handleBatchAction("flag by names", { names: namesInput.split(',').map(n => n.trim()).filter(Boolean) })}
            disabled={true} // Disabled until backend API is ready
            className="flex-1"
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Flag className="h-4 w-4 mr-2" />}
            Flag Names
          </Button>
          <Button
            onClick={() => handleBatchAction("unflag by names", { names: namesInput.split(',').map(n => n.trim()).filter(Boolean) })}
            disabled={true} // Disabled until backend API is ready
            variant="outline"
            className="flex-1"
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Flag className="h-4 w-4 mr-2" />}
            Unflag Names
          </Button>
        </div>
      </div>

      <Separator />

      {/* Flag/Unflag by Time */}
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
    </div>
  );
};

export default BatchFlaggingControls;