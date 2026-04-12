"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSSEStore } from "@/stores/sse-store";
import { useUIStore } from "@/stores/ui-store";
import { queryKeys } from "@/lib/types";
import { ClawSession } from "@/lib/types";
import type { FleetHealth } from "@/lib/types";

export function useSSE(orgId: string | null) {
  const queryClient = useQueryClient();
  const sseStore = useSSEStore();
  const fleetTimeWindow = useUIStore((state) => state.fleetTimeWindow);

  useEffect(() => {
    if (!orgId) return;

    let es: EventSource;
    let retryTimeout: ReturnType<typeof setTimeout>;
    let attempt = 0;

    function connect() {
      es = new EventSource(`/api/sse?orgId=${orgId}`);

      es.onopen = () => {
        sseStore.setStatus("connected");
        attempt = 0;
      };

      es.onerror = () => {
        sseStore.setStatus("reconnecting");
        es?.close();
        const delay = Math.min(1000 * Math.pow(2, attempt++), 10_000);
        retryTimeout = setTimeout(connect, delay);
        if (attempt > 10) sseStore.setStatus("disconnected");
      };

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
               // Also update aggregated counts based on new agents list
               running: update.agents.filter((a: any) => a.status === 'running').length,
               completed: update.agents.filter((a: any) => a.status === 'completed').length,
               failed: update.agents.filter((a: any) => a.status === 'failed').length,
               terminated: update.agents.filter((a: any) => a.status === 'terminated').length,
               total_cost: update.agents.reduce((sum: number, a: any) => sum + a.total_cost_usd, 0),
               total_tool_calls: update.agents.reduce((sum: number, a: any) => sum + a.tool_calls, 0),
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
  }, [orgId, queryClient]);
}
