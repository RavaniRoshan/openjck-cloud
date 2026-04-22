"use client";

import { FleetCard } from "@/components/fleet/fleet-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FleetAgent, FleetDensity } from "@/lib/types";
import { Radio, X } from "lucide-react";

interface FleetGridProps {
  agents: FleetAgent[];
  density: FleetDensity;
  onClearFilters?: () => void;
  hasFilters?: boolean;
}

const gridClasses = {
  compact: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2",
  comfortable: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4",
  spacious: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6",
} as const;

export function FleetGrid({ agents, density, onClearFilters, hasFilters }: FleetGridProps) {
  const isFiltered = hasFilters && agents.length === 0;
  
  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 px-4 text-center border border-[var(--oj-border)] rounded-lg bg-[var(--oj-card-gradient)] animate-fade-up">
        <Radio className="h-10 w-10 text-[var(--oj-text-muted)]/30 mb-3" />
        <p className="text-lg font-medium text-[var(--oj-text-primary)] mb-2">
          {isFiltered ? "No sessions match these filters." : "Your fleet is quiet."}
        </p>
        <p className="text-sm text-[var(--oj-text-muted)] max-w-md mb-4">
          {isFiltered 
            ? "Try adjusting your search or time window to see more agents."
            : "Start more than one instrumented agent to see them here."}
        </p>
        {isFiltered && onClearFilters && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onClearFilters}
            className="border-[var(--oj-border)] text-[var(--oj-text-secondary)] hover:bg-[var(--oj-surface-hover)] hover:text-[var(--oj-text-primary)]"
          >
            <X className="h-4 w-4 mr-2" />
            Clear filters
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("grid", gridClasses[density])}>
      {agents.map((agent) => (
        <FleetCard key={agent.session_id} agent={agent} />
      ))}
    </div>
  );
}
