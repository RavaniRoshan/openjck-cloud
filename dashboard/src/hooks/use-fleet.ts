"use client";

import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { queryKeys } from "@/lib/types";
import type { FleetHealth, FleetActivityEvent, TimeWindow } from "@/lib/types";

export function useFleetHealth(window: TimeWindow) {
  return useQuery({
    queryKey: queryKeys.fleet.health(window),
    queryFn: async (): Promise<FleetHealth> => {
      const { data } = await apiClient.get<FleetHealth>(`/api/v1/fleet/health?window=${window}`);
      return data;
    },
    staleTime: 30_000, // 30 seconds - SSE keeps data fresh
    gcTime: 5 * 60_000,
  });
}

export function useFleetActivity(limit: number = 100) {
  return useQuery({
    queryKey: queryKeys.fleet.activity(limit),
    queryFn: async (): Promise<FleetActivityEvent[]> => {
      const { data } = await apiClient.get<FleetActivityEvent[]>(`/api/v1/fleet/activity?limit=${limit}`);
      return data;
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}
