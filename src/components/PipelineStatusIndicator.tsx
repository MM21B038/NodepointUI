"use client";

import React from "react";
import { HardHat, CheckCircle } from "lucide-react";
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
          ? "text-blue-500 hover:text-blue-600 animate-pulse"
          : "text-green-500 hover:text-green-600"
      )}
      title={isPipelineRunning ? "Pipeline Running (Click for status)" : "Pipeline Ready (Click for status)"}
    >
      {isPipelineRunning ? (
        <HardHat className={iconClasses} />
      ) : (
        <CheckCircle className={iconClasses} />
      )}
    </Button>
  );
};

export default PipelineStatusIndicator;