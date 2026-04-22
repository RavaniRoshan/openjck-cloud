"use client";

import React, { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SessionStatus } from "@/lib/types";
import type { FleetAgent } from "@/lib/types";
import { useUIStore } from "@/stores/ui-store";
import { Repeat, Coins } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/ui/status-badge";

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

const FleetCardInner = ({ agent }: FleetCardProps) => {
  const [showParent, setShowParent] = useState(false);
  const openSession = useUIStore((state) => state.openSession);

  // Determine card styling based on status
  const isRunning = agent.status === SessionStatus.Running;
  const isFailed = agent.status === SessionStatus.Failed;

  const cardBaseClasses = "rounded-lg border transition-all duration-200 hover:-translate-y-1 hover:shadow-card cursor-pointer";
  const statusClasses = {
    [SessionStatus.Running]: "bg-[var(--oj-running-card-gradient)] border-l-3 border-l-amber-500 shadow-shadow-glow-amber",
    [SessionStatus.Completed]: "bg-[var(--oj-card-gradient)] border-l-3 border-l-emerald-500",
    [SessionStatus.Failed]: "bg-[var(--oj-failed-card-gradient)] border-l-3 border-l-[var(--oj-danger)]",
    [SessionStatus.Terminated]: "bg-[var(--oj-card-gradient)] border-l-3 border-l-slate-500",
  }[agent.status];

  const textCostColor = isRunning ? "text-amber-400" : "text-[var(--oj-text-primary)]";

  // Calculate duration
  const startedAt = new Date(agent.started_at).getTime();
  const endedAt = agent.status === SessionStatus.Running ? Date.now() : new Date(agent.ended_at || agent.started_at).getTime();
  const durationSeconds = Math.floor((endedAt - startedAt) / 1000);
  const startedAgo = formatDistanceToNow(startedAt, { addSuffix: true });

  return (
    <div
      className={cn(
        cardBaseClasses,
        statusClasses,
        "p-4 flex flex-col gap-3 min-h-[140px]"
      )}
      onClick={() => openSession(agent.session_id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openSession(agent.session_id);
        }
      }}
      aria-label={`View agent ${agent.claw_name}, status: ${agent.status}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="font-mono font-bold text-sm truncate flex-1 text-[var(--oj-text-primary)]" title={agent.claw_name}>
          {agent.claw_name}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
           {agent.loop_detected && (
             <Repeat className="h-4 w-4 text-amber-500" />
           )}
          <StatusBadge status={agent.status} />
        </div>
      </div>

      {/* Body */}
      <div className="flex items-center gap-3 text-xs text-[var(--oj-text-muted)] font-mono flex-1">
        <span>{agent.steps} steps</span>
        <span>·</span>
        <span>{agent.tool_calls} tools</span>
        <span>·</span>
        <span className={cn("flex items-center gap-1", textCostColor)}>
          <Coins className="h-3 w-3" />
          ${agent.total_cost_usd.toFixed(4)}
        </span>
      </div>

       {/* Footer */}
       <div className="flex items-center justify-between text-xs font-mono text-[var(--oj-text-muted)] pt-2 border-t border-[var(--oj-border)]">
         <div className="flex items-center gap-2">
           <Tooltip>
             <TooltipTrigger>
               <span className="cursor-help">Started {startedAgo}</span>
             </TooltipTrigger>
             <TooltipContent>
               {format(new Date(startedAt), "MMM d, yyyy HH:mm:ss O")}
             </TooltipContent>
           </Tooltip>
           <span>·</span>
           <span>{formatDuration(durationSeconds)}</span>
         </div>

         {agent.parent_session_id && (
           <div className="flex items-center gap-1">
             <button
               onClick={(e) => {
                 e.stopPropagation();
                 setShowParent(!showParent);
                 openSession(agent.parent_session_id!);
               }}
               className="text-xs text-amber-400 hover:underline flex items-center gap-1"
             >
               ↑ from{" "}
               <Tooltip>
                 <TooltipTrigger>
                   <span className="cursor-help font-mono">
                     {showParent ? agent.parent_session_id.slice(0, 8) + "..." : "parent"}
                   </span>
                 </TooltipTrigger>
                 {showParent && (
                   <TooltipContent>
                     {agent.parent_session_id}
                   </TooltipContent>
                 )}
               </Tooltip>
            </button>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-[var(--oj-text-secondary)] hover:text-[var(--oj-text-primary)] hover:bg-[var(--oj-surface-hover)]"
          onClick={(e) => {
            e.stopPropagation();
            openSession(agent.session_id);
          }}
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
