"use client";

import { cn } from "@/lib/utils";
import type { FleetDensity, TimeWindow } from "@/lib/types";

interface FleetControlsProps {
  density: FleetDensity;
  setDensity: (density: FleetDensity) => void;
  timeWindow: TimeWindow;
  setTimeWindow: (window: TimeWindow) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const densityOptions: { value: FleetDensity; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
  { value: "spacious", label: "Spacious" },
];

const timeWindowOptions: { value: TimeWindow; label: string }[] = [
  { value: "1h", label: "1 hour" },
  { value: "6h", label: "6 hours" },
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
];

function SelectInput({
  value,
  onValueChange,
  children,
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      className="h-9 rounded-md border border-border bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </select>
  );
}

export function FleetControls({
  density,
  setDensity,
  timeWindow,
  setTimeWindow,
  searchQuery,
  setSearchQuery,
}: FleetControlsProps) {
  return (
    <div className="flex items-center gap-4">
      {/* Density Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Density:</span>
        <SelectInput value={density} onValueChange={(v) => setDensity(v as FleetDensity)}>
          {densityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </div>

      {/* Time Window Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Window:</span>
        <SelectInput value={timeWindow} onValueChange={(v) => setTimeWindow(v as TimeWindow)}>
          {timeWindowOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </div>

      {/* Search Input */}
      <div className="flex-1 max-w-md">
        <input
          type="text"
          placeholder="Search by claw name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
    </div>
  );
}
