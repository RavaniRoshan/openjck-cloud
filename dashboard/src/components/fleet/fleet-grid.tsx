"use client";

import { FleetCard } from "@/components/fleet/fleet-card";
import { cn } from "@/lib/utils";
import type { FleetAgent, FleetDensity } from "@/lib/types";

interface FleetGridProps {
  agents: FleetAgent[];
  density: FleetDensity;
}

const gridClasses = {
  compact: "grid-cols-4 gap-2",
  comfortable: "grid-cols-3 gap-4",
  spacious: "grid-cols-2 gap-6",
};

export function FleetGrid({ agents, density }: FleetGridProps) {
  if (agents.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground border border-border rounded-lg bg-card">
        <p className="text-center">
          Your fleet is empty. Start an instrumented agent to begin monitoring.
        </p>
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
