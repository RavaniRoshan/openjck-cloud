"use client";

import { useEffect, useState, useMemo } from "react";
import { useSessions } from "@/hooks/use-sessions";
import { useSSE } from "@/hooks/use-sse";
import { createBrowserClient } from "@/lib/supabase/client";
import { LoopWarningBanner } from "@/components/sessions/loop-warning-banner";
import { StatsBar } from "@/components/sessions/stats-bar";
import { SessionsTable } from "@/components/sessions/sessions-table";
import { SessionDrawer } from "@/components/sessions/session-drawer";
import { ClawSession } from "@/lib/types";

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

export default function SessionsPage() {
  const orgId = useOrgId();
  const { data: sessions = [], isLoading, error } = useSessions();

  // Sort: running first, then others (by started_at desc)
  const sortedSessions = useMemo(() => {
    const running = sessions.filter((s) => s.status === "running");
    const others = sessions.filter((s) => s.status !== "running");
    // Sort each group by started_at descending (newest first)
    const sortByStarted = (a: ClawSession, b: ClawSession) => {
      const dateA = new Date(a.started_at || a.created_at).getTime();
      const dateB = new Date(b.started_at || b.created_at).getTime();
      return dateB - dateA;
    };
    running.sort(sortByStarted);
    others.sort(sortByStarted);
    return [...running, ...others];
  }, [sessions]);

  // Initialize SSE connection once we have orgId
  useSSE(orgId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading sessions...
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
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Sessions</h1>
          <div className="text-sm text-muted-foreground">
            {sessions.length} total
          </div>
        </div>

        <LoopWarningBanner sessions={sessions} />
        <StatsBar sessions={sessions} />
        <SessionsTable sessions={sortedSessions} />
      </div>
      <SessionDrawer />
    </>
  );
}
