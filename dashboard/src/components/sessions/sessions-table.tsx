"use client";

import { useEffect, useState } from "react";
import { useTerminateMutation } from "@/hooks/use-sessions";
import { useUIStore } from "@/stores/ui-store";
import { ClawSession, SessionStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { Square } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SessionsTableProps {
  sessions: ClawSession[];
}

function formatDuration(startedAt: string | null, endedAt: string | null, status: SessionStatus, now: number): string {
  if (!startedAt) return "-";
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : now;
  const seconds = Math.floor((end - start) / 1000);

  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  } else {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);
}

function TerminateButton({ session }: { session: ClawSession }) {
  const terminateMutation = useTerminateMutation();
  const [showDialog, setShowDialog] = useState(false);

  const handleClick = () => {
    if (session.total_cost_usd > 0.1) {
      setShowDialog(true);
    } else {
      terminateMutation.mutate(session.session_id);
    }
  };

  const handleConfirm = () => {
    setShowDialog(false);
    terminateMutation.mutate(session.session_id);
  };

   return (
     <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
       <AlertDialogTrigger>
         <Button
           variant="ghost"
           size="sm"
           onClick={handleClick}
           disabled={session.status !== "running" || terminateMutation.isPending}
           className="h-7 px-2 text-xs text-[var(--oj-text-secondary)] hover:text-[var(--oj-text-primary)] hover:bg-[var(--oj-surface-hover)]"
           aria-label="Terminate session"
         >
           {terminateMutation.isPending ? (
             "Terminating..."
           ) : (
             <>
               <Square className="h-3 w-3 mr-1" />
               Terminate
             </>
           )}
         </Button>
       </AlertDialogTrigger>
       <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Terminate session?</AlertDialogTitle>
          <AlertDialogDescription>
            This session has accumulated a cost of <span className="font-mono">${session.total_cost_usd.toFixed(4)}</span>. 
            {" "}Are you sure you want to terminate it?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function SessionsTable({ sessions }: SessionsTableProps) {
  const [now, setNow] = useState(Date.now());
  const openSession = useUIStore((state) => state.openSession);

  // Update now every second for live duration
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Define grid columns (12 columns)
  const gridCols = "grid-cols-[80px_120px_100px_140px_60px_100px_100px_80px_70px_80px_90px_90px_80px]";

  return (
    <div className="rounded-md border border-[var(--oj-border)] overflow-x-auto">
      {/* Header */}
      <div className={`${gridCols} grid bg-[var(--oj-surface-0)] border-b border-[var(--oj-border)] sticky top-0 z-10`}>
        <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--oj-text-muted)]">
          SESSION ID
        </div>
        <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--oj-text-muted)]">
          STATUS
        </div>
        <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--oj-text-muted)]">
          TYPE
        </div>
        <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--oj-text-muted)]">
          PROJECT
        </div>
        <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--oj-text-muted)]">
          REC
        </div>
        <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--oj-text-muted)]">
          STARTED
        </div>
        <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--oj-text-muted)]">
          ENDED
        </div>
        <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--oj-text-muted)]">
          DURATION
        </div>
        <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--oj-text-muted)]">
          STEPS
        </div>
        <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--oj-text-muted)]">
          COST
        </div>
        <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--oj-text-muted)]">
          INPUT
        </div>
        <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--oj-text-muted)]">
          OUTPUT
        </div>
        <div className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--oj-text-muted)]">
          ACTIONS
        </div>
      </div>

      {/* Body */}
      <div className="max-h-[600px] overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="py-8 text-center text-[var(--oj-text-muted)]">
            No sessions found
          </div>
        ) : (
          sessions.map((session) => {
            const isRunning = session.status === "running";
            const isFailed = session.status === "failed";

            return (
              <div
                key={session.session_id}
                role="button"
                tabIndex={0}
                aria-label={`View session ${session.claw_name}, status: ${session.status}`}
                onClick={() => openSession(session.session_id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openSession(session.session_id);
                  }
                }}
                className={cn(
                  gridCols,
                  "grid items-center border-b border-[var(--oj-border)] transition-colors duration-200 cursor-pointer",
                  isRunning
                    ? "bg-[var(--oj-running-card-gradient)] border-l-3 border-l-amber-500 animate-amber-border"
                    : isFailed
                    ? "bg-[var(--oj-failed-card-gradient)] border-l-3 border-l-[var(--oj-danger)]"
                    : "bg-[var(--oj-surface-1)] hover:bg-[var(--oj-surface-hover)] border-l-3 border-l-transparent"
                )}
              >
                {/* SESSION ID */}
                <div className="px-4 py-3">
                  <Tooltip>
                    <TooltipTrigger>
                      <span className="font-mono text-xs text-[var(--oj-text-primary)] cursor-help">
                        {session.session_id.slice(0, 8)}...
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{session.session_id}</TooltipContent>
                  </Tooltip>
                </div>

                {/* STATUS */}
                <div className="px-4 py-3">
                  <StatusBadge status={session.status} />
                </div>

                {/* TYPE */}
                <div className="px-4 py-3">
                  <span className="font-mono font-bold text-sm text-[var(--oj-text-primary)]">
                    {session.claw_name}
                  </span>
                </div>

                {/* PROJECT */}
                <div className="px-4 py-3 text-sm text-[var(--oj-text-secondary)] whitespace-nowrap">
                  {session.project ?? "-"}
                </div>

                {/* REC */}
                <div className="px-4 py-3 flex justify-center">
                  {session.has_recording ? (
                    <span className="relative flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-pulse" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                    </span>
                  ) : (
                    <span className="text-[var(--oj-text-muted)]">-</span>
                  )}
                </div>

                 {/* STARTED */}
                 <div className="px-4 py-3">
                   {session.started_at ? (
                     <Tooltip>
                       <TooltipTrigger>
                         <span className="font-mono text-xs text-[var(--oj-text-muted)] cursor-help">
                           {formatDistanceToNow(new Date(session.started_at), { addSuffix: true })}
                         </span>
                       </TooltipTrigger>
                       <TooltipContent>
                         {format(new Date(session.started_at), "MMM d, yyyy HH:mm:ss O")}
                       </TooltipContent>
                     </Tooltip>
                   ) : (
                     <span className="text-[var(--oj-text-muted)]">-</span>
                   )}
                 </div>

                 {/* ENDED */}
                 <div className="px-4 py-3">
                   {session.ended_at ? (
                     <Tooltip>
                       <TooltipTrigger>
                         <span className="font-mono text-xs text-[var(--oj-text-muted)] cursor-help">
                           {formatDistanceToNow(new Date(session.ended_at), { addSuffix: true })}
                         </span>
                       </TooltipTrigger>
                       <TooltipContent>
                         {format(new Date(session.ended_at), "MMM d, yyyy HH:mm:ss O")}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-[var(--oj-text-muted)]">-</span>
                  )}
                </div>

                {/* DURATION */}
                <div className="px-4 py-3">
                  <span className="font-mono text-xs text-[var(--oj-text-muted)]">
                    {formatDuration(session.started_at, session.ended_at, session.status, now)}
                  </span>
                </div>

                {/* STEPS */}
                <div className="px-4 py-3">
                  <span className="font-mono text-xs text-[var(--oj-text-primary)]">
                    {formatNumber(session.steps)}
                  </span>
                </div>

                {/* COST */}
                <div className="px-4 py-3">
                  <span className={cn(
                    "font-mono text-xs",
                    session.total_cost_usd > 0 ? "text-amber-400" : "text-[var(--oj-text-primary)]"
                  )}>
                    {formatCurrency(session.total_cost_usd)}
                  </span>
                </div>

                {/* INPUT */}
                <div className="px-4 py-3">
                  <span className="font-mono text-xs text-[var(--oj-text-primary)]">
                    {formatNumber(session.total_input_tokens)}
                  </span>
                </div>

                {/* OUTPUT */}
                <div className="px-4 py-3">
                  <span className="font-mono text-xs text-[var(--oj-text-primary)]">
                    {formatNumber(session.total_output_tokens)}
                  </span>
                </div>

                {/* ACTIONS */}
                <div className="px-4 py-3 text-right">
                  {session.status === "running" && <TerminateButton session={session} />}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
