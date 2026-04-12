"use client";

import React, { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SessionStatus } from "@/lib/types";
import type { FleetAgent } from "@/lib/types";

interface FleetCardProps {
  agent: FleetAgent;
}

// Format duration in seconds to human readable
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

// Get status badge component
function StatusBadge({ status }: { status: SessionStatus }) {
  const badgeClasses = {
    [SessionStatus.Running]: "bg-amber-500/10 text-amber-500 border-0 font-medium animate-amber-pulse",
    [SessionStatus.Completed]: "bg-green-500/10 text-green-500 border-0 font-medium",
    [SessionStatus.Failed]: "bg-red-500/10 text-red-500 border-0 font-medium",
    [SessionStatus.Terminated]: "bg-muted text-muted-foreground border border-border font-medium",
  };

  return (
    <Badge className={badgeClasses[status]}>
      {status.toUpperCase()}
    </Badge>
  );
}

const FleetCardInner = ({ agent }: FleetCardProps) => {
  const [showParent, setShowParent] = useState(false);

  // Border classes based on status
  const borderClass = {
    [SessionStatus.Running]: "border-l-[3px] border-l-amber-500 hover:shadow-[0_0_0_1px_rgba(245,158,11,0.3)]",
    [SessionStatus.Completed]: "border-l-[3px] border-l-green-500",
    [SessionStatus.Failed]: "border-l-[3px] border-l-red-500",
    [SessionStatus.Terminated]: "border-l-[3px] border-l-zinc-500",
  }[agent.status];

  // Calculate duration
  const startedAt = new Date(agent.started_at).getTime();
  const endedAt = agent.status === SessionStatus.Running ? Date.now() : new Date(agent.ended_at || agent.started_at).getTime();
  const durationSeconds = Math.floor((endedAt - startedAt) / 1000);
  const startedAgo = formatDistanceToNow(startedAt, { addSuffix: true });

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 flex flex-col gap-3 min-h-[140px] transition-shadow",
        borderClass
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="font-mono font-bold text-sm truncate flex-1" title={agent.claw_name}>
          {agent.claw_name}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {agent.loop_detected && (
            <span className="text-amber-500" title="Loop detected">
              ⚠
            </span>
          )}
          <StatusBadge status={agent.status} />
        </div>
      </div>

      {/* Body */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono flex-1">
        <span>{agent.steps} steps</span>
        <span>·</span>
        <span>{agent.tool_calls} tools</span>
        <span>·</span>
        <span className="text-amber">${agent.total_cost_usd.toFixed(4)}</span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
        <div className="flex items-center gap-2">
          <span>Started {startedAgo}</span>
          <span>·</span>
          <span>{formatDuration(durationSeconds)}</span>
        </div>

        {agent.parent_session_id && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowParent(!showParent)}
              className="text-xs text-amber hover:underline"
            >
              ↑ from {showParent ? agent.parent_session_id.slice(0, 8) + "..." : "parent"}
            </button>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs"
        >
          View Trace →
        </Button>
      </div>
    </div>
  );
};

export const FleetCard = React.memo(
  FleetCardInner,
  (prev, next) => {
    // Custom equality check
    return (
      prev.agent.session_id === next.agent.session_id &&
      prev.agent.status === next.agent.status &&
      prev.agent.total_cost_usd === next.agent.total_cost_usd &&
      prev.agent.steps === next.agent.steps &&
      prev.agent.loop_detected === next.agent.loop_detected &&
      prev.agent.ended_at === next.agent.ended_at &&
      prev.agent.parent_session_id === next.agent.parent_session_id
    );
  }
);
