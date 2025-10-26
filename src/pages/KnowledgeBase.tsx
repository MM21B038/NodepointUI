"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Link, Loader2, Search, Filter, X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Define the color mapping for node types
const TYPE_COLORS: Record<string, { class: string; hex: string }> = {
  Person: { class: "bg-blue-500", hex: "#3b82f6" },
  Organization: { class: "bg-green-500", hex: "#10b981" },
  Location: { class: "bg-red-500", hex: "#ef4444" },
  Concept: { class: "bg-yellow-500", hex: "#f59e0b" },
  Event: { class: "bg-purple-500", hex: "#a855f7" },
  Product: { class: "bg-pink-500", hex: "#ec4899" },
  Document: { class: "bg-indigo-500", hex: "#6366f1" },
  Default: { class: "bg-gray-400", hex: "#9ca3af" },
};

// Utility function to get the Tailwind class for a node type
const getNodeColorClass = (type: string) => {
  // Return null if the type is 'Default' or not explicitly defined, so the indicator is hidden.
  if (type === 'Default' || !TYPE_COLORS[type]) {
    return null;
  }
  return TYPE_COLORS[type].class;
};

// Utility function to get the hex code for a node type (used for checkbox coloring)
const getNodeColorHex = (type: string) => {
  return TYPE_COLORS[type]?.hex || TYPE_COLORS.Default.hex;
};

// Mock data for demonstration
const mockNodes = [
  { id: "n1", label: "Alice Johnson", type: "Person" },
  { id: "n2", label: "Acme Corp", type: "Organization" },
  { id: "n3", label: "New York City", type: "Location" },
  { id: "n4", label: "Quantum Physics", type: "Concept" },
  { id: "n5", label: "Product Launch 2024", type: "Event" },
  { id: "n6", label: "Project X Document", type: "Document" },
  { id: "n7", label: "The Alpha Device", type: "Product" },
  { id: "n8", label: "Unknown Entity", type: "Default" },
];

const mockEdges = [
  { source: "n1", target: "n2", label: "Works At" },
  { source: "n2", target: "n3", label: "Located In" },
  { source: "n4", target: "n1", label: "Studied By" },
];

const KnowledgeBase: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);

  const allNodeTypes = useMemo(() => {
    const types = new Set(mockNodes.map((node) => node.type));
    return Array.from(types).sort();
  }, []);

  const handleTypeToggle = useCallback((type: string, checked: boolean) => {
    setSelectedTypes((prev) => ({
      ...prev,
      [type]: checked,
    }));
  }, []);

  const filteredNodes = useMemo(() => {
    const activeFilters = Object.keys(selectedTypes).filter(
      (type) => selectedTypes[type]
    );

    let nodes = mockNodes;

    // 1. Filter by Type
    if (activeFilters.length > 0) {
      nodes = nodes.filter((node) => activeFilters.includes(node.type));
    }

    // 2. Filter by Search Term
    if (searchTerm) {
      const lowerCaseSearch = searchTerm.toLowerCase();
      nodes = nodes.filter((node) =>
        node.label.toLowerCase().includes(lowerCaseSearch)
      );
    }

    return nodes;
  }, [searchTerm, selectedTypes]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedTypes({});
  };

  const activeFilterCount =
    Object.values(selectedTypes).filter(Boolean).length +
    (searchTerm ? 1 : 0);

  return (
    <div className="flex h-full overflow-hidden bg-gray-50">
      {/* Sidebar/Filter Panel */}
      <div className="w-64 flex-shrink-0 border-r bg-white p-4 flex flex-col">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Filter className="w-5 h-5 mr-2 text-gray-600" />
          Filters
        </h2>

        {/* Search Input */}
        <div className="relative mb-4">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search nodes..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Active Filters Summary */}
        {activeFilterCount > 0 && (
          <div className="mb-4 flex justify-between items-center text-sm text-gray-600">
            <span>{activeFilterCount} active filter(s)</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-auto p-1 text-xs text-blue-600 hover:bg-blue-50"
            >
              Clear All
            </Button>
          </div>
        )}

        {/* Node Type Filters */}
        <div className="flex-grow overflow-y-auto pr-2 space-y-3">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Node Type</h3>
          {allNodeTypes.map((type) => {
            const isChecked = !!selectedTypes[type];
            const hexColor = getNodeColorHex(type);
            const colorClass = getNodeColorClass(type);

            return (
              <div key={type} className="flex items-center space-x-2">
                <Checkbox
                  id={`type-${type}`}
                  checked={isChecked}
                  onCheckedChange={(checked) =>
                    handleTypeToggle(type, !!checked)
                  }
                  // Custom styling for the checkbox when checked
                  style={
                    isChecked
                      ? {
                          '--tw-ring-offset-shadow': '0 0 #0000',
                          '--tw-ring-shadow': '0 0 #0000',
                          backgroundColor: hexColor,
                          borderColor: hexColor,
                        }
                      : {}
                  }
                  className={cn(
                    "h-4 w-4 rounded-sm border-gray-300 transition-colors",
                    // Ensure the checkmark is white when checked
                    isChecked ? "data-[state=checked]:text-white" : ""
                  )}
                />
                <Label
                  htmlFor={`type-${type}`}
                  className="flex items-center text-sm font-normal cursor-pointer w-full"
                >
                  {/* Conditionally render the color span only if a specific color class exists */}
                  {colorClass && (
                    <span
                      className={cn(
                        "h-3 w-3 rounded-full mr-2 flex-shrink-0",
                        colorClass
                      )}
                    ></span>
                  )}
                  <span className="truncate">{type}</span>
                </Label>
              </div>
            );
          })}
        </div>

        {/* Action Button */}
        <div className="mt-4 pt-4 border-t">
          <Button className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add New Node
          </Button>
        </div>
      </div>

      {/* Main Content Area (Knowledge Graph View) */}
      <div className="flex-1 flex flex-col overflow-hidden p-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-800">
            Knowledge Base Explorer
          </h1>
          <Button variant="outline" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Link className="mr-2 h-4 w-4" />
            )}
            View Graph
          </Button>
        </div>

        {/* Results Display */}
        <Card className="flex-1 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Filtered Nodes ({filteredNodes.length})
            </CardTitle>
            {activeFilterCount > 0 && (
              <X
                className="h-4 w-4 text-gray-500 cursor-pointer hover:text-gray-700"
                onClick={handleClearFilters}
              />
            )}
          </CardHeader>
          <CardContent className="h-full overflow-y-auto">
            {filteredNodes.length === 0 ? (
              <p className="text-center text-gray-500 mt-8">
                No nodes match your current filters.
              </p>
            ) : (
              <div className="space-y-2">
                {filteredNodes.map((node) => (
                  <div
                    key={node.id}
                    className="flex items-center p-2 border rounded-md bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <span
                      className={cn(
                        "h-3 w-3 rounded-full mr-3 flex-shrink-0",
                        getNodeColorClass(node.type)
                      )}
                    ></span>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{node.label}</p>
                      <p className="text-xs text-gray-500">{node.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default KnowledgeBase;