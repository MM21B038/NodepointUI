"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { AuthScopeOption } from "@/database/authStorage";

interface ScopeCheckboxListProps {
  availableScopes: AuthScopeOption[];
  selectedScopes: string[];
  onSelectedScopesChange: (scopes: string[]) => void;
  maxHeightClassName?: string;
}

export default function ScopeCheckboxList({
  availableScopes,
  selectedScopes,
  onSelectedScopesChange,
  maxHeightClassName = "max-h-40",
}: ScopeCheckboxListProps) {
  const toggleScope = (scopeId: string, checked: boolean) => {
    onSelectedScopesChange(
      checked
        ? [...selectedScopes, scopeId]
        : selectedScopes.filter((s) => s !== scopeId)
    );
  };

  if (availableScopes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No scopes available.</p>
    );
  }

  return (
    <div
      className={`grid gap-2 overflow-y-auto rounded-md border p-3 ${maxHeightClassName}`}
    >
      {availableScopes.map((scope) => (
        <label
          key={scope.id}
          className="flex cursor-pointer flex-col gap-0.5 text-sm sm:flex-row sm:items-center sm:gap-2"
        >
          <span className="flex items-center gap-2">
            <Checkbox
              checked={selectedScopes.includes(scope.id)}
              onCheckedChange={(c) => toggleScope(scope.id, Boolean(c))}
            />
            <span className="font-mono text-xs">{scope.id}</span>
          </span>
          {scope.label !== scope.id ? (
            <span className="text-xs text-muted-foreground sm:ml-6">
              {scope.label}
            </span>
          ) : null}
        </label>
      ))}
    </div>
  );
}
