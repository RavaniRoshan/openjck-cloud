"use client";

import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import { ClawSession, SessionStatus, RecordingStatus } from "@/lib/types";
import { Repeat, ShieldAlert, Coins, Zap, GitFork } from "lucide-react";

interface SessionDrawerHeaderProps {
  session: ClawSession | null;
  recordingStatus: RecordingStatus | null;
}

export function SessionDrawerHeader({ session, recordingStatus }: SessionDrawerHeaderProps) {
  if (!session) {
    return (
      <div className="border-b border-[var(--oj-border)] p-4 bg-[var(--oj-surface-1)]">
        <div className="h-6 w-48 bg-[var(--oj-surface-2)] animate-shimmer rounded" />
        <div className="mt-2 h-4 w-32 bg-[var(--oj-surface-2)] animate-shimmer rounded" />
      </div>
    );
  }

  const startTime = session.started_at ? new Date(session.started_at) : null;
  const endTime = session.ended_at ? new Date(session.ended_at) : null;
  const duration = startTime && endTime ? Math.round((endTime.getTime() - startTime.getTime()) / 1000) : null;

  return (
    <div className="border-b border-[var(--oj-border)] p-4 bg-[var(--oj-surface-1)] space-y-3">
      {/* Session name + status badges row */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h2 className="text-lg font-mono font-bold text-[var(--oj-text-primary)] tracking-tight">
            {session.claw_name}
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <StatusBadge status={session.status} />
            {session.loop_detected && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--oj-accent-glow)] text-amber-400 border border-amber-500/30">
                <Repeat className="h-3 w-3" />
                Loop detected
              </span>
            )}
            {session.guard_triggered && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--oj-danger-muted)] text-[var(--oj-danger)]">
                <ShieldAlert className="h-3 w-3" />
                Guard triggered
              </span>
            )}
            {recordingStatus?.has_recording ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-pulse" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                {recordingStatus.step_count} steps recorded
              </span>
            ) : (
              <span className="text-xs text-[var(--oj-text-muted)]">No recording</span>
            )}
          </div>
        </div>

        {/* Cost pill */}
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1.5 text-lg font-mono text-amber-400">
            <Coins className="h-4 w-4" />
            ${session.total_cost_usd.toFixed(4)}
          </div>
          <div className="text-xs text-[var(--oj-text-muted)]">Total cost</div>
        </div>
      </div>

      {/* Metadata row: Started, Ended, Duration */}
      <div className="flex flex-wrap gap-6 text-sm text-[var(--oj-text-muted)]">
        <div>
          <span className="block text-xs text-[var(--oj-text-muted)]">Started</span>
          {startTime ? (
            <span className="font-mono text-[var(--oj-text-primary)]">
              {format(startTime, "MMM d, yyyy HH:mm:ss O")}
            </span>
          ) : (
            <span className="font-mono text-[var(--oj-text-primary)]">—</span>
          )}
        </div>
        {endTime && (
          <div>
            <span className="block text-xs text-[var(--oj-text-muted)]">Ended</span>
            <span className="font-mono text-[var(--oj-text-primary)]">
              {format(endTime, "MMM d, yyyy HH:mm:ss O")}
            </span>
          </div>
        )}
        {duration && (
          <div>
            <span className="block text-xs text-[var(--oj-text-muted)]">Duration</span>
            <span className="font-mono text-[var(--oj-text-primary)]">
              {Math.floor(duration / 60)}m {duration % 60}s
            </span>
          </div>
        )}
      </div>

      {/* Failure cause */}
      {session.failure_root_cause && (
        <div className="pt-2 border-t border-[var(--oj-border)]">
          <div className="text-xs text-[var(--oj-text-muted)] mb-1">Failure cause</div>
          <div className="text-sm font-mono text-[var(--oj-danger)] bg-[var(--oj-danger-muted)] p-2 rounded border-l-2 border-[var(--oj-danger)]">
            {session.failure_root_cause}
          </div>
        </div>
      )}

      {/* Guard metadata */}
      {session.guard_termination && (
        <div className="pt-2 border-t border-[var(--oj-border)]">
          <div className="text-xs text-[var(--oj-text-muted)] mb-2">Guard metadata</div>
          <div className="space-y-2 text-sm bg-[var(--oj-surface-2)] p-3 rounded">
            <div className="flex justify-between">
              <span className="text-[var(--oj-text-muted)] flex items-center gap-2">
                <ShieldAlert className="h-3.5 w-3.5" />
                Type
              </span>
              <span className="font-mono text-[var(--oj-text-primary)]">{session.guard_termination.guard_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--oj-text-muted)]">Detail</span>
              <span className="font-mono text-[var(--oj-text-primary)] max-w-[60%] text-right">{session.guard_termination.detail}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--oj-text-muted)]">Triggered at</span>
              <span className="font-mono text-[var(--oj-text-primary)]">
                {format(new Date(session.guard_termination.triggered_at), "MMM d, HH:mm:ss")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--oj-text-muted)]">Strike</span>
              <span className="font-mono text-[var(--oj-text-primary)]">{session.guard_termination.strike}/2</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
