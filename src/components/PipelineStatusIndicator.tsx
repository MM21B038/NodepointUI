"use client";

import React from "react";
import { HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PipelineStatusIndicatorProps {
  isPipelineRunning: boolean;
  onClick: (e?: React.MouseEvent<HTMLButtonElement>) => void;
}

const PipelineStatusIndicator: React.FC<PipelineStatusIndicatorProps> = ({
  isPipelineRunning,
  onClick,
}) => {
  const iconClasses = "h-5 w-5";

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent any default/propagation that might interfere with other UI state
    e.preventDefault();
    e.stopPropagation();
    onClick?.(e);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleClick}
      className={cn(
        "relative h-8 w-8 rounded-full transition-all duration-300 text-muted-foreground hover:text-foreground"
      )}
      title={isPipelineRunning ? "Pipeline Running (Click for status)" : "Pipeline Ready (Click for status)"}
    >
      <HardHat className={iconClasses} />
    </Button>
  );
};

export default PipelineStatusIndicator;
