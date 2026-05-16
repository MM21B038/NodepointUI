"use client";

import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { GraphNode } from "@/database/workspaceStorage";
import * as d3 from "d3"; // For consistent color scaling
import PieChartLegendDropdown from "./PieChartLegendDropdown"; // Import the new dropdown legend

interface NodeTypeDistributionChartProps {
  nodes: GraphNode[];
  isLoading: boolean;
}

// Use the same D3 color scale as in InteractiveGraphVisualization for consistency
const COLORS = d3.scaleOrdinal(d3.schemeSet3).range();

// Custom Tooltip for Pie Chart
const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-md border bg-popover p-2 text-popover-foreground shadow-md text-sm">
        <p className="font-semibold">{data.name}</p>
        <p>Count: {data.value}</p>
        <p>Percentage: {(data.percent * 100).toFixed(2)}%</p>
      </div>
    );
  }
  return null;
};

const NodeTypeDistributionChart: React.FC<NodeTypeDistributionChartProps> = ({
  nodes,
  isLoading,
}) => {
  const nodeTypeCounts = nodes.reduce((acc, node) => {
    acc[node.type] = (acc[node.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalNodes = nodes.length;

  const chartData = Object.entries(nodeTypeCounts)
    .map(([type, count]) => ({
      name: type,
      value: count,
      percent: totalNodes > 0 ? count / totalNodes : 0,
    }))
    .sort((a, b) => b.value - a.value); // Sort by value descending

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xl font-semibold">
          Node Type Distribution
        </CardTitle>
        <PieChartLegendDropdown data={chartData} colors={COLORS} />
      </CardHeader>
      <CardContent className="flex-grow flex items-center justify-center p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="mt-2 text-muted-foreground">Loading graph data...</span>
          </div>
        ) : chartData.length === 0 ? (
          <p className="text-muted-foreground">No node type data available.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={40} // For a donut chart effect
                fill="#8884d8"
                dataKey="value"
                paddingAngle={3} // Creates the "exploded" visual separation
                // Removed labelLine and label props
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomPieTooltip />} />
              {/* Removed the standard Legend component */}
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default NodeTypeDistributionChart;