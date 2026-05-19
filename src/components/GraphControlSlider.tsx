"use client";

import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export interface GraphControlSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  className?: string;
  "aria-label"?: string;
  /** Optional label row above the slider (simulation controls style). */
  label?: string;
  formatValue?: (value: number) => string;
}

/**
 * Radix slider wired for smooth drag: keeps local state while dragging and commits
 * on release so parent re-renders do not reset the thumb mid-gesture.
 */
export function GraphControlSlider({
  value,
  min,
  max,
  step = 1,
  onChange,
  className,
  "aria-label": ariaLabel,
  label,
  formatValue,
}: GraphControlSliderProps) {
  const [localValue, setLocalValue] = useState(value);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!isDraggingRef.current) {
      setLocalValue(value);
    }
  }, [value]);

  const display = formatValue ? formatValue(localValue) : localValue;

  const slider = (
    <Slider
      min={min}
      max={max}
      step={step}
      value={[localValue]}
      aria-label={ariaLabel ?? label}
      className={cn("graph-control-range w-full", className)}
      onPointerDown={(e) => {
        e.stopPropagation();
        isDraggingRef.current = true;
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
      }}
      onPointerCancel={(e) => {
        e.stopPropagation();
        isDraggingRef.current = false;
      }}
      onValueChange={([v]) => setLocalValue(v)}
      onValueCommit={([v]) => {
        isDraggingRef.current = false;
        setLocalValue(v);
        onChange(v);
      }}
    />
  );

  if (!label) {
    return slider;
  }

  return (
    <div className="relative z-10 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-xs tabular-nums text-foreground">{display}</span>
      </div>
      {slider}
    </div>
  );
}
