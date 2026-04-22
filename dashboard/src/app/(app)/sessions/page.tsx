"use client";

import { useEffect, useState, useMemo } from "react";
import { useSessions } from "@/hooks/use-sessions";
import { useSSE } from "@/hooks/use-sse";
import { createBrowserClient } from "@/lib/supabase/client";
import { LoopWarningBanner } from "@/components/sessions/loop-warning-banner";
import { StatsBar } from "@/components/sessions/stats-bar";
import { SessionsTable } from "@/components/sessions/sessions-table";
import { SessionDrawer } from "@/components/sessions/session-drawer";
import { SessionPageSkeleton } from "@/components/sessions/sessions-skeleton";
import { StaleDataBanner } from "@/components/layout/stale-data-banner";
import { ErrorBoundary } from "@/components/layout/error-boundary";
import { ClawSession } from "@/lib/types";
import { Bot, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/api/error-handler";

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

// Error state component
function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-12 h-12 rounded-full bg-[var(--oj-danger-muted)] flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-6 w-6 text-[var(--oj-danger)]" />
        </div>
        <h3 className="text-lg font-semibold text-[var(--oj-text-primary)] mb-2">
          Failed to load sessions
        </h3>
        <p className="text-sm text-[var(--oj-text-secondary)] mb-4">
          {getErrorMessage(error)}
        </p>
        <Button
          onClick={onRetry}
          variant="outline"
          className="border-[var(--oj-border)] text-[var(--oj-text-primary)]"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    </div>
  );
}

function SessionsContent() {
  const orgId = useOrgId();
  const { data: sessions = [], isLoading, error, refetch } = useSessions();

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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Sessions</h1>
        </div>
        <SessionPageSkeleton />
      </div>
    );
  }

  if (error) {
    return <ErrorState error={error} onRetry={refetch} />;
  }

  if (sessions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Sessions</h1>
        </div>
        <div className="flex flex-col items-center justify-center h-64 px-4 text-center">
          <Bot className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium text-foreground mb-2">No claw sessions yet.</p>
          <p className="text-sm text-muted-foreground max-w-md">
            Start your first instrumented ClawSession to see it here. Sessions are created when you run
            your Python agent code with OpenJCK.
          </p>
        </div>
        <SessionDrawer />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <StaleDataBanner />
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Sessions</h1>
          <div className="text-sm text-muted-foreground">
            {sessions.length} total
          </div>
        </div>

        <ErrorBoundary section="loop warning">
          <LoopWarningBanner sessions={sessions} />
        </ErrorBoundary>
        <ErrorBoundary section="stats">
          <StatsBar sessions={sessions} />
        </ErrorBoundary>
        <ErrorBoundary section="sessions table">
          <SessionsTable sessions={sortedSessions} />
        </ErrorBoundary>
      </div>
      <SessionDrawer />
    </>
  );
}

export default function SessionsPage() {
  return (
    <ErrorBoundary section="sessions page">
      <SessionsContent />
    </ErrorBoundary>
  );
}
