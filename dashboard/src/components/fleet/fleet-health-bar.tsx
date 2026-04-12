"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { FleetHealth } from "@/lib/types";

interface FleetHealthBarProps {
  health: FleetHealth | undefined;
  isLoading?: boolean;
}

export function FleetHealthBar({ health, isLoading }: FleetHealthBarProps) {
  if (isLoading || !health) {
    return (
      <div className="flex items-center gap-4 p-4 border border-border rounded-lg bg-card animate-pulse">
        <div className="h-5 w-24 bg-muted rounded" />
        <div className="h-5 w-24 bg-muted rounded" />
        <div className="h-5 w-24 bg-muted rounded" />
        <div className="h-5 w-24 bg-muted rounded" />
        <div className="h-5 w-32 bg-muted rounded" />
        <div className="h-5 w-20 bg-muted rounded" />
      </div>
    );
  }

  const statusBadge = {
    healthy: (
      <Badge className="bg-[#22c55e]/20 text-[#22c55e] border-0 font-medium">
        Healthy
      </Badge>
    ),
    warning: (
      <Badge className="bg-[#f59e0b]/20 text-[#f59e0b] border-0 font-medium animate-amber-pulse">
        Warning
      </Badge>
    ),
    critical: (
      <Badge className="bg-[#ef4444]/20 text-[#ef4444] border-0 font-medium">
        Critical
      </Badge>
    ),
  };

  return (
    <div className="flex items-center gap-4 p-4 border border-border rounded-lg bg-card flex-wrap">
      <Badge className="bg-amber-500/10 text-amber-500 border-0 font-medium animate-amber-pulse">
        {health.running} Running
      </Badge>
      <Badge className="bg-green-500/10 text-green-500 border-0 font-medium">
        {health.completed} Completed
      </Badge>
      <Badge variant="destructive">
        {health.failed} Failed
      </Badge>
      <Badge className="bg-muted text-muted-foreground border border-border font-medium">
        {health.terminated} Terminated
      </Badge>
      
      <div className="h-4 w-px bg-border" />
      
      <div className="font-mono text-amber text-sm">
        ${health.total_cost.toFixed(4)}
      </div>
      
      <div className={cn("font-mono text-sm", health.status === 'critical' ? "text-red-500" : health.status === 'warning' ? "text-amber-500" : "text-green-500")}>
        {statusBadge[health.status]}
      </div>
    </div>
  );
}
