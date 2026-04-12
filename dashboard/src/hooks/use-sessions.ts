"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { queryKeys, ClawSession, RecordingStatus } from "@/lib/types";

export interface ListSessionsParams {
  status?: string;
  claw_name?: string;
  project?: string;
  limit?: number;
  offset?: number;
}

export function useSessions(params: ListSessionsParams = {}) {
  return useQuery({
    queryKey: queryKeys.sessions.list(params as Record<string, unknown>),
    queryFn: async () => {
      const { data } = await apiClient.get<ClawSession[]>("/api/v1/sessions", { params });
      return data;
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useSession(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.sessions.detail(sessionId),
    queryFn: async () => {
      const { data } = await apiClient.get<ClawSession>(`/api/v1/sessions/${sessionId}`);
      return data;
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled: !!sessionId,
  });
}

export function useSessionSteps(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.sessions.steps(sessionId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/v1/sessions/${sessionId}/steps`);
      return data;
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled: !!sessionId,
  });
}

export function useHasRecording(sessionId: string) {
  return useQuery<RecordingStatus>({
    queryKey: queryKeys.sessions.hasRecording(sessionId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/v1/sessions/${sessionId}/has-recording`);
      return data;
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled: !!sessionId,
  });
}

export function useTerminateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data } = await apiClient.post<ClawSession>(`/api/v1/sessions/${sessionId}/terminate`);
      return data;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(
        queryKeys.sessions.list({}),
        (old: ClawSession[] = []) =>
          old.map((s) => (s.session_id === updated.session_id ? { ...s, ...updated } : s))
      );
    },
    onError: (error) => {
      console.error("Failed to terminate session:", error);
      // Optionally add toast.error
    },
  });
}
