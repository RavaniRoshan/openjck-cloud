"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSSEStore } from "@/stores/sse-store";
import { useUIStore } from "@/stores/ui-store";
import { queryKeys, ClawSession } from "@/lib/types";
import type { FleetHealth } from "@/lib/types";

/**
 * SSE Hook with Reconciliation Support
 * Handles real-time updates and data reconciliation on reconnect
 */
export function useSSE(orgId: string | null) {
  const queryClient = useQueryClient();
  const sseStore = useSSEStore();
  const fleetTimeWindow = useUIStore((state) => state.fleetTimeWindow);
  const {
    retryToken,
    consumeRetryToken,
    setStatus,
    setDisconnectedAt,
    needsReconciliation,
    markReconciled,
  } = sseStore;

  // Track if we've already triggered reconciliation for this connection
  const reconciledRef = useRef(false);

  useEffect(() => {
    if (!orgId) return;

    // Consume any pending retry token to trigger reconnection
    consumeRetryToken();

    let es: EventSource;
    let retryTimeout: ReturnType<typeof setTimeout>;
    let attempt = 0;

    // Data reconciliation - refetch sessions and fleet after long disconnect
    const reconcileData = () => {
      if (reconciledRef.current) return;

      // Invalidate sessions query to trigger refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.list({}) });

      // Invalidate fleet health
      queryClient.invalidateQueries({ queryKey: queryKeys.fleet.health(fleetTimeWindow) });

      reconciledRef.current = true;
      markReconciled();

      toast.info("Data refreshed", {
        description: "Reconnected after extended disconnect. Data has been refreshed.",
        duration: 3000,
      });
    };

    function connect() {
      es = new EventSource(`/api/sse?orgId=${orgId}`);

      es.onopen = () => {
        setStatus("connected");
        attempt = 0;

        // Check if we need to reconcile after reconnect
        if (needsReconciliation && !reconciledRef.current) {
          reconcileData();
        }
      };

      es.onerror = () => {
        setStatus("reconnecting");
        reconciledRef.current = false;
        es?.close();
        const delay = Math.min(1000 * Math.pow(2, attempt++), 10_000);
        retryTimeout = setTimeout(connect, delay);
        if (attempt > 10) {
          setStatus("disconnected");
          setDisconnectedAt(Date.now());
        }
      };

      // Snapshot event - sent on initial connection
      es.addEventListener("snapshot", (e) => {
        const snapshot = JSON.parse(e.data);
        // Replace local data with server state
        if (snapshot.sessions) {
          queryClient.setQueryData(queryKeys.sessions.list({}), snapshot.sessions);
        }
        if (snapshot.fleet) {
          queryClient.setQueryData(queryKeys.fleet.health(fleetTimeWindow), snapshot.fleet);
        }
      });

      es.addEventListener("session_created", (e) => {
        const session: ClawSession = JSON.parse(e.data);
        queryClient.setQueryData(
          queryKeys.sessions.list({}),
          (old: ClawSession[] = []) => [session, ...old]
        );
      });

      es.addEventListener("session_update", (e) => {
        const partial: Partial<ClawSession> & { session_id: string } = JSON.parse(e.data);
        queryClient.setQueryData(
          queryKeys.sessions.list({}),
          (old: ClawSession[] = []) =>
            old.map((s) => (s.session_id === partial.session_id ? { ...s, ...partial } : s))
        );
        queryClient.setQueryData(
          queryKeys.sessions.detail(partial.session_id),
          (old: ClawSession | undefined) => (old ? { ...old, ...partial } : old)
        );
      });

      es.addEventListener("session_ended", (e) => {
        const ended: ClawSession = JSON.parse(e.data);
        queryClient.setQueryData(
          queryKeys.sessions.list({}),
          (old: ClawSession[] = []) =>
            old.map((s) => (s.session_id === ended.session_id ? ended : s))
        );
      });

      es.addEventListener("loop_detected", (e) => {
        const { session_id } = JSON.parse(e.data);
        queryClient.setQueryData(
          queryKeys.sessions.list({}),
          (old: ClawSession[] = []) =>
            old.map((s) => (s.session_id === session_id ? { ...s, loop_detected: true } : s))
        );
        queryClient.setQueryData(
          queryKeys.sessions.detail(session_id),
          (old: ClawSession | undefined) =>
            old ? { ...old, loop_detected: true } : old
        );
      });

      es.addEventListener("guard_triggered", (e) => {
        const event = JSON.parse(e.data);
        toast.warning(`Guard triggered in ${event.claw_name}`, {
          description: event.detail,
        });
      });

      // Fleet update event for real-time agent grid updates
      es.addEventListener("fleet:update", (e) => {
        const update = JSON.parse(e.data);
        queryClient.setQueryData(
          queryKeys.fleet.health(fleetTimeWindow),
          (old: FleetHealth | undefined) => {
            if (!old) return old;
            return {
              ...old,
              agents: update.agents,
              status: update.health_status,
              running: update.agents.filter((a: { status: string }) => a.status === 'running').length,
              completed: update.agents.filter((a: { status: string }) => a.status === 'completed').length,
              failed: update.agents.filter((a: { status: string }) => a.status === 'failed').length,
              terminated: update.agents.filter((a: { status: string }) => a.status === 'terminated').length,
              total_cost: update.agents.reduce((sum: number, a: { total_cost_usd: number }) => sum + a.total_cost_usd, 0),
              total_tool_calls: update.agents.reduce((sum: number, a: { tool_calls: number }) => sum + a.tool_calls, 0),
            };
          }
        );
      });
    }

    connect();

    return () => {
      es?.close();
      clearTimeout(retryTimeout);
    };
  }, [
    orgId,
    retryToken,
    queryClient,
    consumeRetryToken,
    setStatus,
    setDisconnectedAt,
    fleetTimeWindow,
    needsReconciliation,
    markReconciled,
  ]);
}
