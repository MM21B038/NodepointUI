"use client";

import React, { useState } from "react";
import { ChevronDown, Maximize2, RotateCcw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GraphControlSlider } from "@/components/GraphControlSlider";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DEFAULT_GRAPH_SIMULATION_CONFIG,
  type GraphLabelMode,
  type GraphSimulationConfig,
} from "@/lib/graphSimulationConfig";
import { cn } from "@/lib/utils";

interface GraphSimulationControlsProps {
  config: GraphSimulationConfig;
  onChange: (patch: Partial<GraphSimulationConfig>) => void;
  onRestartLayout: () => void;
  onFitView: () => void;
  onResetDefaults: () => void;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const GraphSimulationControls: React.FC<GraphSimulationControlsProps> = ({
  config,
  onChange,
  onRestartLayout,
  onFitView,
  onResetDefaults,
  className,
  open: openProp,
  onOpenChange,
}) => {
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp ?? openInternal;
  const setOpen = onOpenChange ?? setOpenInternal;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      data-graph-controls
      data-kb-overlay
      className={cn(
        "pointer-events-auto isolate flex max-h-[var(--kb-bottom-overlay-max-h)] min-h-0 w-full flex-col overflow-hidden rounded-lg border bg-background/95 shadow-lg backdrop-blur-sm",
        className
      )}
    >
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className="flex h-9 w-full shrink-0 items-center justify-between gap-2 px-3 py-2"
        >
          <span className="flex items-center gap-2 text-xs font-medium">
            <Settings2 className="h-3.5 w-3.5 shrink-0" />
            Graph controls
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 opacity-60 transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="flex min-h-0 flex-1 flex-col overflow-hidden data-[state=closed]:hidden">
        <div
          className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-3 py-2 scroll-smooth overscroll-contain [-webkit-overflow-scrolling:touch]"
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="space-y-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Forces
            </p>
            <GraphControlSlider
              label="Link distance"
              value={config.linkDistance}
              min={50}
              max={400}
              onChange={(linkDistance) => onChange({ linkDistance })}
            />
            <GraphControlSlider
              label="Link strength"
              value={config.linkStrength}
              min={0}
              max={1}
              step={0.05}
              formatValue={(v) => v.toFixed(2)}
              onChange={(linkStrength) => onChange({ linkStrength })}
            />
            <GraphControlSlider
              label="Repulsion (charge)"
              value={config.chargeStrength}
              min={-800}
              max={0}
              onChange={(chargeStrength) => onChange({ chargeStrength })}
            />
            <GraphControlSlider
              label="Center gravity"
              value={config.centerStrength}
              min={0}
              max={1}
              step={0.05}
              formatValue={(v) => v.toFixed(2)}
              onChange={(centerStrength) => onChange({ centerStrength })}
            />
            <GraphControlSlider
              label="X pull"
              value={config.xStrength}
              min={0}
              max={0.5}
              step={0.01}
              formatValue={(v) => v.toFixed(2)}
              onChange={(xStrength) => onChange({ xStrength })}
            />
            <GraphControlSlider
              label="Y pull"
              value={config.yStrength}
              min={0}
              max={0.5}
              step={0.01}
              formatValue={(v) => v.toFixed(2)}
              onChange={(yStrength) => onChange({ yStrength })}
            />
            <GraphControlSlider
              label="Collision radius"
              value={config.collisionRadius}
              min={0}
              max={40}
              onChange={(collisionRadius) => onChange({ collisionRadius })}
            />
            <GraphControlSlider
              label="Friction (velocity decay)"
              value={config.velocityDecay}
              min={0.1}
              max={0.9}
              step={0.05}
              formatValue={(v) => v.toFixed(2)}
              onChange={(velocityDecay) => onChange({ velocityDecay })}
            />
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Display
            </p>
            <GraphControlSlider
              label="Node size"
              value={config.nodeRadius}
              min={4}
              max={20}
              onChange={(nodeRadius) => onChange({ nodeRadius })}
            />
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs text-muted-foreground">Show labels</Label>
              <Switch
                checked={config.showLabels}
                onCheckedChange={(showLabels: boolean) => onChange({ showLabels })}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs text-muted-foreground">Show edges</Label>
              <Switch
                checked={config.showEdges}
                onCheckedChange={(showEdges: boolean) => onChange({ showEdges })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Label mode</Label>
              <div className="flex flex-wrap gap-1">
                {(["always", "onSelect", "onHover"] as GraphLabelMode[]).map((mode) => (
                  <Button
                    key={mode}
                    type="button"
                    variant={config.labelMode === mode ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => onChange({ labelMode: mode })}
                  >
                    {mode === "always" ? "Always" : mode === "onSelect" ? "On select" : "On hover"}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 border-t border-border/60 px-3 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={onRestartLayout}
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Restart
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={onFitView}
          >
            <Maximize2 className="mr-1 h-3 w-3" />
            Fit view
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={onResetDefaults}
          >
            Reset defaults
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export { DEFAULT_GRAPH_SIMULATION_CONFIG };
