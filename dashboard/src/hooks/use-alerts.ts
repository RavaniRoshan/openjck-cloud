"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { queryKeys } from "@/lib/types";

export interface AlertHook {
  id: string;
  name: string;
  webhook_url: string;
  alert_type: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export function useAlerts() {
  return useQuery<AlertHook[]>({
    queryKey: queryKeys.alerts.all,
    queryFn: async () => {
      const { data } = await apiClient.get<AlertHook[]>("/api/v1/alerts");
      return data;
    },
    staleTime: 60_000,
  });
}

export function useCreateAlert() {
  const queryClient = useQueryClient();

  return useMutation<AlertHook, Error, { name: string; webhook_url: string; alert_type?: string }>({
    mutationFn: async (payload) => {
      const { data } = await apiClient.post<AlertHook>("/api/v1/alerts", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all });
    },
  });
}

export function useUpdateAlert() {
  const queryClient = useQueryClient();

  return useMutation<AlertHook, Error, { id: string; [key: string]: unknown }>({
    mutationFn: async ({ id, ...updates }) => {
      const { data } = await apiClient.patch<AlertHook>(`/api/v1/alerts/${id}`, updates);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all });
    },
  });
}

export function useDeleteAlert() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete(`/api/v1/alerts/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all });
    },
  });
}
