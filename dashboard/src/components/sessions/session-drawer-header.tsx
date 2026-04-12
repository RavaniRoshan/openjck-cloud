"use client";

import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ClawSession, SessionStatus, RecordingStatus } from "@/lib/types";

interface SessionDrawerHeaderProps {
  session: ClawSession | null;
  recordingStatus: RecordingStatus | null;
}

export function SessionDrawerHeader({ session, recordingStatus }: SessionDrawerHeaderProps) {
  const statusVariant = {
    running: "default",
    completed: "secondary",
    failed: "destructive",
    terminated: "outline",
  } as const;

  const statusLabel = {
    running: "Running",
    completed: "Completed",
    failed: "Failed",
    terminated: "Terminated",
  };

  if (!session) {
    return (
      <div className="border-b border-border p-4 bg-surface">
        <div className="h-6 w-48 bg-muted animate-pulse rounded" />
        <div className="mt-2 h-4 w-32 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  const startTime = session.started_at ? new Date(session.started_at) : null;
  const endTime = session.ended_at ? new Date(session.ended_at) : null;
  const duration = startTime && endTime ? Math.round((endTime.getTime() - startTime.getTime()) / 1000) : null;

  return (
    <div className="border-b border-border p-4 bg-surface space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{session.claw_name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={statusVariant[session.status]}>
              {statusLabel[session.status]}
            </Badge>
            {session.loop_detected && (
              <Badge variant="outline" className="border-amber-500 text-amber-500">
                Loop detected
              </Badge>
            )}
            {session.guard_triggered && (
              <Badge variant="destructive">
                Guard triggered
              </Badge>
            )}
            {recordingStatus?.has_recording ? (
              <Badge variant="outline" className="border-green-500/50 text-green-500">
                <span className="relative flex h-2 w-2 mr-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                {recordingStatus.step_count} steps recorded
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">No recording</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-mono text-amber-500">
            ${session.total_cost_usd.toFixed(4)}
          </div>
          <div className="text-xs text-muted-foreground">Total cost</div>
        </div>
      </div>

      <div className="flex gap-4 text-sm text-muted-foreground">
        <div>
          <span className="block text-xs text-muted-foreground">Started</span>
          {startTime ? (
            <span className="font-mono text-foreground">
              {format(startTime, "MMM d, yyyy HH:mm:ss O")}
            </span>
          ) : (
            <span className="font-mono text-foreground">—</span>
          )}
        </div>
        {endTime && (
          <div>
            <span className="block text-xs text-muted-foreground">Ended</span>
            <span className="font-mono text-foreground">
              {format(endTime, "MMM d, yyyy HH:mm:ss O")}
            </span>
          </div>
        )}
        {duration && (
          <div>
            <span className="block text-xs text-muted-foreground">Duration</span>
            <span className="font-mono text-foreground">
              {Math.floor(duration / 60)}m {duration % 60}s
            </span>
          </div>
        )}
      </div>

      {session.failure_root_cause && (
        <div className="pt-2 border-t border-border">
          <div className="text-xs text-muted-foreground mb-1">Failure cause</div>
          <div className="text-sm font-mono text-destructive bg-destructive/10 p-2 rounded">
            {session.failure_root_cause}
          </div>
        </div>
      )}
    </div>
  );
}
