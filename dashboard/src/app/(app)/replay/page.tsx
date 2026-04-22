"use client";

import { useState, useMemo, useEffect } from "react";
import { useSessions, useHasRecording, useSessionSteps } from "@/hooks/use-sessions";
import { useSSE } from "@/hooks/use-sse";
import { createBrowserClient } from "@/lib/supabase/client";
import { ClawSession } from "@/lib/types";
import { SessionStepTrace } from "@/components/sessions/session-step-trace";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
 import { cn } from "@/lib/utils";
 import { formatDistanceToNow, format } from "date-fns";
 import { Search, Play, FileText, ExternalLink, Circle } from "lucide-react";
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
      if (!error && data) setOrgId(data.org_id);
    }
    fetchOrgId();
  }, []);

  return orgId;
}

function RecordingStatusBadge({ sessionId }: { sessionId: string }) {
  const { data } = useHasRecording(sessionId);
  if (!data) return <span className="text-muted-foreground text-xs">Checking…</span>;
  if (!data.has_recording) return <span className="text-muted-foreground text-xs">No recording</span>;
  return (
    <Badge variant="outline" className="border-green-500/50 text-green-500 text-xs">
      <span className="relative flex h-2 w-2 mr-1.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
      </span>
      {data.step_count} steps
    </Badge>
  );
}

export default function ReplayPage() {
  const orgId = useOrgId();
  const { data: sessions = [], isLoading, error } = useSessions();
  useSSE(orgId);

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: steps } = useSessionSteps(selectedSessionId || "");
  const selectedSession = sessions.find((s) => s.session_id === selectedSessionId) || null;

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const matchesSearch =
        searchQuery === "" ||
        s.session_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.claw_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.project ?? "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [sessions, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading sessions…
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Session Replay</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Debug without rerunning. Select a recorded session to inspect its steps.
          </p>
        </div>
        <a
          href="https://docs.openjck.cloud/features/replay"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-accent hover:underline"
        >
          <FileText className="h-4 w-4" />
          ReplaySession docs
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search sessions…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-surface border-border text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Two-column layout: session list + step view */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Replayable sessions list */}
        <div className="rounded-md border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface">
            <h2 className="text-sm font-semibold text-foreground">Recorded Sessions</h2>
          </div>
           {filteredSessions.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-64 px-4 text-center">
               <Circle className="h-10 w-10 text-muted-foreground/30 mb-3" />
               <p className="text-sm font-medium text-foreground mb-1">No replayable sessions found</p>
               <p className="text-xs text-muted-foreground max-w-xs">
                 Replay becomes available when recording is enabled. Sessions are recorded by default
                 with <code className="text-accent">record=True</code> in ClawSession.
               </p>
             </div>
           ) : (
             <div className="rounded-md border border-border overflow-hidden">
               <div className="px-4 py-3 border-b border-border bg-surface">
                 <h2 className="text-sm font-semibold text-foreground">Recorded Sessions</h2>
               </div>
               <div className="max-h-[500px] overflow-x-auto overflow-y-auto">
                 <Table>
                   <TableHeader>
                     <TableRow className="border-border hover:bg-muted">
                       <TableHead className="text-muted-foreground font-mono text-xs">SESSION</TableHead>
                       <TableHead className="text-muted-foreground text-xs">TYPE</TableHead>
                       <TableHead className="text-muted-foreground text-xs">STATUS</TableHead>
                       <TableHead className="text-muted-foreground text-xs">REC</TableHead>
                       <TableHead className="text-muted-foreground text-xs">STARTED</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {filteredSessions.map((session) => (
                       <TableRow
                         key={session.session_id}
                         className={cn(
                           "border-border hover:bg-muted cursor-pointer",
                           selectedSessionId === session.session_id && "bg-accent/10 border-l-2 border-l-accent"
                         )}
                         onClick={() => setSelectedSessionId(session.session_id)}
                       >
                         <TableCell className="font-mono text-xs text-foreground">
                           {session.session_id.slice(0, 8)}
                         </TableCell>
                         <TableCell className="font-mono font-bold text-foreground text-xs">{session.claw_name}</TableCell>
                         <TableCell>
                           <StatusBadge status={session.status} />
                         </TableCell>
                         <TableCell>
                           <RecordingStatusBadge sessionId={session.session_id} />
                         </TableCell>
                         <TableCell className="font-mono text-muted-foreground text-xs">
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
                         </TableCell>
                       </TableRow>
                     ))}
                   </TableBody>
                 </Table>
               </div>
              </div>
            )}
          </div>

          {/* Right: Step trace view */}
        <div className="rounded-md border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Step Trace</h2>
            {selectedSession && (
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger>
                    <span className="text-xs text-muted-foreground font-mono cursor-help">
                      {selectedSession.session_id.slice(0, 8)}...
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{selectedSession.session_id}</TooltipContent>
                </Tooltip>
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  {selectedSession.claw_name}
                </Badge>
             </div>
           )}
         </div>
           {!selectedSessionId ? (
            <div className="flex flex-col items-center justify-center h-64 px-4 text-center">
              <Play className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">Select a session</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Choose a recorded session from the list to view its step-by-step execution trace.
              </p>
            </div>
          ) : steps && steps.length > 0 ? (
            <ScrollArea className="h-[500px]">
              <div className="p-4">
                <SessionStepTrace steps={steps} />
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 px-4 text-center">
              <p className="text-sm text-muted-foreground">No steps found for this session</p>
            </div>
          )}
        </div>
      </div>

       {/* Info banner */}
       <div className="rounded-md border border-[var(--oj-border)] bg-[var(--oj-surface-1)] p-4">
         <h3 className="text-sm font-semibold text-[var(--oj-text-primary)] mb-2">How Replay Works</h3>
         <p className="text-xs text-[var(--oj-text-muted)] leading-relaxed mb-3">
           Replay runs a recorded session locally using stored step packets. You can override tool
           outputs to test "what if" scenarios and detect divergence from the original execution.
           The full replay engine runs in your Python code via{" "}
           <code className="text-[var(--oj-accent)] bg-[var(--oj-accent-glow)] px-1 py-0.5 rounded">ReplaySession</code> —
           not from the dashboard.
         </p>
         <pre className="text-xs font-mono bg-[var(--oj-surface-2)] p-3 rounded overflow-x-auto text-[var(--oj-text-primary)]">
{`# In your Python code:
from openjck import ReplaySession
replay = ReplaySession.load("session-uuid")
result = replay.run(overrides={
  "read_file": lambda x: {"content": "mocked"}
})
# result.diverged_steps tells you what changed`}
         </pre>
       </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: "bg-amber-500/[0.15] text-amber-500 border-amber-500/50",
    completed: "bg-green-500/[0.14] text-green-500 border-green-500/50",
    failed: "bg-red-500/[0.14] text-red-500 border-red-500/50",
    terminated: "text-gray-400 border border-gray-500/50",
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs",
        status === "running" && "animate-amber-pulse",
        colors[status] || "bg-muted text-muted-foreground"
      )}
    >
      {status}
    </Badge>
  );
}
