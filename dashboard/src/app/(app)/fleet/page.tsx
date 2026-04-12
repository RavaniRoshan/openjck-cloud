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
import type { FleetAgent, TimeWindow, FleetDensity } from "@/lib/types";

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

export default function FleetPage() {
  const orgId = useOrgId();
  const { fleetDensity, fleetTimeWindow, setFleetDensity, setFleetTimeWindow } = useUIStore();
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch fleet health and activity
  const {
    data: health,
    isLoading: healthLoading,
    error: healthError,
  } = useFleetHealth(fleetTimeWindow);

  const {
    data: activity,
    isLoading: activityLoading,
    error: activityError,
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

  if (!orgId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading organization...
      </div>
    );
  }

  if (healthError) {
    return (
      <div className="p-4 bg-destructive/10 border border-destructive rounded-md text-destructive">
        Error loading fleet health: {healthError.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Fleet</h1>
        <div className="text-sm text-muted-foreground">
          {health ? `${health.running} running` : "No active agents"}
        </div>
      </div>

      {/* Health Bar */}
      <FleetHealthBar health={health} isLoading={healthLoading} />

      {/* Controls */}
      <FleetControls
        density={fleetDensity}
        setDensity={setFleetDensity}
        timeWindow={fleetTimeWindow}
        setTimeWindow={setFleetTimeWindow}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* Agent Grid */}
      <FleetGrid agents={filteredAgents} density={fleetDensity} />

      {/* Activity Feed */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-2">
          Activity Feed
        </h2>
        <ActivityFeed events={activity || []} isLoading={activityLoading} />
      </div>
    </div>
  );
}
