"use client";

import { useEffect, useState, useMemo } from "react";
import { useSSE } from "@/hooks/use-sse";
import { createBrowserClient } from "@/lib/supabase/client";
import { useUIStore } from "@/stores/ui-store";
import { useFleetHealth, useFleetActivity } from "@/hooks/use-fleet";
import { FleetHealthBar } from "@/components/fleet/fleet-health-bar";
import { FleetControls } from "@/components/fleet/fleet-controls";
import { FleetGrid } from "@/components/fleet/fleet-grid";
import { ActivityFeed } from "@/components/fleet/activity-feed";
import { FleetPageSkeleton } from "@/components/fleet/fleet-skeleton";
import { StaleDataBanner } from "@/components/layout/stale-data-banner";
import { ErrorBoundary } from "@/components/layout/error-boundary";
import type { FleetAgent, TimeWindow, FleetDensity } from "@/lib/types";
import { AlertCircle, RefreshCw } from "lucide-react";
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
          Failed to load fleet data
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

function FleetContent() {
  const orgId = useOrgId();
  const { fleetDensity, fleetTimeWindow, setFleetDensity, setFleetTimeWindow } = useUIStore();
  const [searchQuery, setSearchQuery] = useState("");

  const handleClearFilters = () => {
    setSearchQuery("");
  };

  const hasFilters = searchQuery.trim().length > 0;

  // Fetch fleet health and activity
  const {
    data: health,
    isLoading: healthLoading,
    error: healthError,
    refetch: refetchHealth,
  } = useFleetHealth(fleetTimeWindow);

  const {
    data: activity,
    isLoading: activityLoading,
  } = useFleetActivity(100);

  // Initialize SSE connection (includes fleet:update handling)
  useSSE(orgId);

  // Filter agents by search query
  const filteredAgents = useMemo(() => {
    if (!health?.agents) return [];
    if (!searchQuery.trim()) return health.agents;
    const query = searchQuery.toLowerCase();
    return health.agents.filter((agent) =>
      agent.claw_name.toLowerCase().includes(query)
    );
  }, [health?.agents, searchQuery]);

  if (!orgId || healthLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Fleet</h1>
        </div>
        <FleetPageSkeleton />
      </div>
    );
  }

  if (healthError) {
    return <ErrorState error={healthError} onRetry={refetchHealth} />;
  }

  return (
    <div className="space-y-6">
      <StaleDataBanner />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Fleet</h1>
        <div className="text-sm text-muted-foreground">
          {health ? `${health.running} running` : "No active agents"}
        </div>
      </div>

      {/* Health Bar */}
      <ErrorBoundary section="fleet health">
        <FleetHealthBar health={health} isLoading={healthLoading} />
      </ErrorBoundary>

      {/* Controls */}
      <ErrorBoundary section="fleet controls">
        <FleetControls
          density={fleetDensity}
          setDensity={setFleetDensity}
          timeWindow={fleetTimeWindow}
          setTimeWindow={setFleetTimeWindow}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      </ErrorBoundary>

      {/* Agent Grid */}
      <ErrorBoundary section="fleet grid">
        <FleetGrid agents={filteredAgents} density={fleetDensity} onClearFilters={handleClearFilters} hasFilters={hasFilters} />
      </ErrorBoundary>

      {/* Activity Feed */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-2">
          Activity Feed
        </h2>
        <ErrorBoundary section="activity feed">
          <ActivityFeed events={activity || []} isLoading={activityLoading} />
        </ErrorBoundary>
      </div>
    </div>
  );
}

export default function FleetPage() {
  return (
    <ErrorBoundary section="fleet page">
      <FleetContent />
    </ErrorBoundary>
  );
}
