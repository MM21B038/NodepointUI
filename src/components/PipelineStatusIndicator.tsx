"use client";

import React from "react";
import { HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PipelineStatusIndicatorProps {
  isPipelineRunning: boolean;
  onClick: () => void;
}

const PipelineStatusIndicator: React.FC<PipelineStatusIndicatorProps> = ({
  isPipelineRunning,
  onClick,
}) => {
  const iconClasses = "h-5 w-5";
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={cn(
        "relative h-8 w-8 rounded-full transition-all duration-300",
        isPipelineRunning 
          ? "text-primary hover:text-primary/80" 
          : "text-muted-foreground hover:text-foreground",
      )}
      title={isPipelineRunning ? "Pipeline Running (Click for status)" : "Pipeline Ready (Click for status)"}
    >
      <HardHat className={cn(iconClasses, isPipelineRunning && "animate-spin")} />
    </Button>
  );
};

export default PipelineStatusIndicator;