"use client";

import React from "react";
import { Palette, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface PieChartLegendDropdownProps {
  data: { name: string; value: number; percent: number }[];
  colors: string[];
}

const PieChartLegendDropdown: React.FC<PieChartLegendDropdownProps> = ({ data, colors }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Palette className="h-4 w-4" />
          <span>Node Types</span>
          <ChevronDown className="h-4 w-4 ml-auto" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-auto min-w-[var(--radix-dropdown-menu-trigger-width)] max-w-[300px] max-h-[250px] overflow-y-auto hide-scrollbar p-2"
      >
        {data.length === 0 ? (
          <DropdownMenuItem disabled>No node types</DropdownMenuItem>
        ) : (
          data.map((entry, index) => (
            <DropdownMenuItem key={`legend-item-${entry.name}`} className="flex items-center justify-between w-full overflow-hidden py-1 px-2">
              <div className="flex items-center flex-grow min-w-0">
                <span
                  className={cn("h-3 w-3 rounded-full mr-2 flex-shrink-0")}
                  style={{ backgroundColor: colors[index % colors.length] }}
                ></span>
                <span className="flex-grow truncate">{entry.name}</span>
              </div>
              <span className="text-muted-foreground flex-shrink-0 ml-2 whitespace-nowrap">{entry.value}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default PieChartLegendDropdown;