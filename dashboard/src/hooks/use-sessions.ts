"use client";

import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { queryKeys, ClawSession, RecordingStatus } from "@/lib/types";
import { handleApiError } from "@/lib/api/error-handler";

export interface ListSessionsParams {
  status?: string;
  claw_name?: string;
  project?: string;
  limit?: number;
  offset?: number;
}

// Default timeouts
const DEFAULT_TIMEOUT = 10000; // 10s for normal requests
const LONG_TIMEOUT = 30000;    // 30s for heavy operations

/**
 * AbortController wrapper for request cancellation
 */
function createAbortController(timeout: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  return { controller, timeoutId };
}

export function useSessions(params: ListSessionsParams = {}) {
  return useQuery({
    queryKey: queryKeys.sessions.list(params as Record<string, unknown>),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<ClawSession[]>("/api/v1/sessions", {
        params,
        signal, // Use TanStack Query's signal for cancellation
      });
      return data;
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

export function useSession(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.sessions.detail(sessionId),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<ClawSession>(`/api/v1/sessions/${sessionId}`, {
        signal,
        timeout: DEFAULT_TIMEOUT,
      });
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
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get(`/api/v1/sessions/${sessionId}/steps`, {
        signal,
        timeout: LONG_TIMEOUT,
      });
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
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get(`/api/v1/sessions/${sessionId}/has-recording`, {
        signal,
        timeout: DEFAULT_TIMEOUT,
      });
      return data;
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled: !!sessionId,
  });
}

export function useTerminateMutation() {
  const queryClient = useQueryClient();
  const abortControllerRef = useRef<AbortController | null>(null);

  return useMutation({
    mutationFn: async (sessionId: string) => {
      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const { data } = await apiClient.post<ClawSession>(
          `/api/v1/sessions/${sessionId}/terminate`,
          {},
          {
            signal: controller.signal,
            timeout: DEFAULT_TIMEOUT,
          }
        );
        return data;
      } finally {
        abortControllerRef.current = null;
      }
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(
        queryKeys.sessions.list({}),
        (old: ClawSession[] = []) =>
          old.map((s) => (s.session_id === updated.session_id ? { ...s, ...updated } : s))
      );
      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.list({}) });
    },
    onError: (error) => {
      handleApiError(error, { context: "Failed to terminate session" });
    },
  });
}
