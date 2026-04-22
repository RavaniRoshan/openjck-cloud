"use client";

import { useEffect, useState, useMemo } from "react";
import { useSessions } from "@/hooks/use-sessions";
import { useSSE } from "@/hooks/use-sse";
import { createBrowserClient } from "@/lib/supabase/client";
import { StatsBar } from "@/components/sessions/stats-bar";
import { SessionsTable } from "@/components/sessions/sessions-table";
import { SessionDrawer } from "@/components/sessions/session-drawer";
import { ClawSession } from "@/lib/types";
import { AlertTriangle, ShieldAlert } from "lucide-react";
 import { format, formatDistanceToNow } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function useOrgId(): string | null {
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrgId() {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("organization_members")
        .select("org_id")
        .eq("user_id", user.id)
        .single();
      if (!error && data) {
        setOrgId(data.org_id);
      }
    }
    fetchOrgId();
  }, []);

  return orgId;
}

export default function FailureLogPage() {
  const orgId = useOrgId();
  const { data: allSessions = [], isLoading, error } = useSessions();

  // Filter only terminated sessions, sorted by started_at desc
  const terminatedSessions = useMemo(() => {
    const terminated = allSessions.filter((s) => s.status === "terminated");
    const sorted = [...terminated].sort((a, b) => {
      const dateA = new Date(a.started_at || a.created_at).getTime();
      const dateB = new Date(b.started_at || b.created_at).getTime();
      return dateB - dateA;
    });
    return sorted;
  }, [allSessions]);

  // Initialize SSE connection
  useSSE(orgId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading failure log...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 border border-destructive rounded-md text-destructive">
        Error loading sessions: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Failure Log</h1>
        <div className="text-sm text-muted-foreground">
          {terminatedSessions.length} terminated session{terminatedSessions.length !== 1 ? "s" : ""}
        </div>
      </div>

      <StatsBar sessions={allSessions} />

      {terminatedSessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 px-4 text-center border border-dashed border-border rounded-lg">
          <AlertTriangle className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-lg font-medium text-foreground mb-2">No failures in this window.</p>
          <p className="text-sm text-muted-foreground max-w-md">
            Failed or terminated sessions will appear here. Sessions fail when guards trigger or loops are detected.
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-x-auto">
          {/* Reuse SessionsTable but with terminated-only data */}
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Session ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Project
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Started
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Cost
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Steps
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Cause
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {terminatedSessions.map((session) => (
                <tr key={session.session_id} className="hover:bg-muted">
                  <td className="px-4 py-3 font-mono text-xs text-foreground">
                    {session.session_id.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3">
<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-gray-400 border border-gray-500/50">
                    terminated
                  </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-sm text-foreground">{session.claw_name}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{session.project ?? "-"}</td>
<td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                   {session.started_at ? (
                   <Tooltip>
                     <TooltipTrigger>
                       <span className="cursor-help">
                         {formatDistanceToNow(new Date(session.started_at), { addSuffix: true })}
                       </span>
                     </TooltipTrigger>
                     <TooltipContent>
                       {format(new Date(session.started_at), "MMM d, yyyy HH:mm:ss O")}
                     </TooltipContent>
                   </Tooltip>
                   ) : "-"}
                </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {session.started_at && session.ended_at
                      ? Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000) + "s"
                      : "-"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-amber-500">
                    ${session.total_cost_usd.toFixed(4)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">
                    {session.steps}
                  </td>
<td className="px-4 py-3 text-xs">
                      {session.guard_triggered ? (
                        <span className="flex items-center gap-1 text-destructive">
                          <ShieldAlert className="h-3 w-3" />
                          Guard: {session.guard_termination?.guard_type || "unknown"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{session.failure_root_cause || "-"}</span>
                      )}
                    </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SessionDrawer />
    </div>
  );
}
