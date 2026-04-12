"use client";

import { useEffect, useState } from "react";
import { useTerminateMutation } from "@/hooks/use-sessions";
import { useUIStore } from "@/stores/ui-store";
import { ClawSession, SessionStatus } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Square } from "lucide-react";

interface SessionsTableProps {
  sessions: ClawSession[];
}

const statusColors: Record<SessionStatus, string> = {
  running: "bg-amber-500/20 text-amber-500 border-amber-500/50 animate-amber-pulse",
  completed: "bg-green-500/20 text-green-500 border-green-500/50",
  failed: "bg-red-500/20 text-red-500 border-red-500/50",
  terminated: "bg-gray-500/20 text-gray-500 border-gray-500/50",
};

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

  const handleClick = () => {
    if (session.total_cost_usd > 0.1) {
      if (!window.confirm("This session has cost > $0.10. Are you sure you want to terminate it?")) {
        return;
      }
    }
    terminateMutation.mutate(session.session_id);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={session.status !== "running" || terminateMutation.isPending}
      className="h-7 px-2 text-xs"
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

  return (
    <div className="rounded-md border border-border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-muted">
            <TableHead className="text-muted-foreground font-mono text-xs whitespace-nowrap">
              SESSION ID
            </TableHead>
            <TableHead className="text-muted-foreground">STATUS</TableHead>
            <TableHead className="text-muted-foreground">TYPE</TableHead>
            <TableHead className="text-muted-foreground whitespace-nowrap">PROJECT</TableHead>
            <TableHead className="text-muted-foreground whitespace-nowrap">REC</TableHead>
            <TableHead className="text-muted-foreground whitespace-nowrap">STARTED</TableHead>
            <TableHead className="text-muted-foreground whitespace-nowrap">ENDED</TableHead>
            <TableHead className="text-muted-foreground whitespace-nowrap">DURATION</TableHead>
            <TableHead className="text-muted-foreground whitespace-nowrap">COST</TableHead>
            <TableHead className="text-muted-foreground whitespace-nowrap">INPUT</TableHead>
            <TableHead className="text-muted-foreground whitespace-nowrap">OUTPUT</TableHead>
            <TableHead className="text-right text-muted-foreground">ACTIONS</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                No sessions found
              </TableCell>
            </TableRow>
          ) : (
            sessions.map((session) => (
              <TableRow
                key={session.session_id}
                className={cn(
                  "border-border hover:bg-muted cursor-pointer",
                  session.status === "running" && "border-l-4 border-l-amber-500"
                )}
                onClick={() => openSession(session.session_id)}
              >
                <TableCell className="font-mono text-xs text-foreground whitespace-nowrap">
                  {session.session_id.slice(0, 8)}...
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusColors[session.status]}>
                    {session.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-foreground whitespace-nowrap">{session.claw_name}</TableCell>
                <TableCell className="text-foreground whitespace-nowrap">
                  {session.project ?? "-"}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {session.has_recording ? (
                    <span className="relative flex h-3 w-3 mx-auto">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                  {session.started_at
                    ? formatDistanceToNow(new Date(session.started_at), { addSuffix: true })
                    : "-"}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                  {session.ended_at
                    ? formatDistanceToNow(new Date(session.ended_at), { addSuffix: true })
                    : "-"}
                </TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs whitespace-nowrap">
                  {formatDuration(session.started_at, session.ended_at, session.status, now)}
                </TableCell>
                <TableCell className={cn("font-mono text-xs whitespace-nowrap", session.total_cost_usd > 0 ? "text-amber-500" : "text-foreground")}>
                  {formatCurrency(session.total_cost_usd)}
                </TableCell>
                <TableCell className="font-mono text-xs text-foreground whitespace-nowrap">
                  {formatNumber(session.total_input_tokens)}
                </TableCell>
                <TableCell className="font-mono text-xs text-foreground whitespace-nowrap">
                  {formatNumber(session.total_output_tokens)}
                </TableCell>
                <TableCell className="text-right">
                  {session.status === "running" && (
                    <TerminateButton session={session} />
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
