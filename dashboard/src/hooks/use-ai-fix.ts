"use client";

import { useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { queryKeys, AiFixResult, ClawSession } from "@/lib/types";
import { handleApiError } from "@/lib/api/error-handler";
import { toast } from "sonner";

// Track pending AI fix requests to prevent double-submission
const pendingFixes = new Set<string>();

// Timeout for AI fix requests (30 seconds for AI operations)
const AI_FIX_TIMEOUT = 30000;

export function useAIFix() {
  const queryClient = useQueryClient();
  const abortControllerRef = useRef<AbortController | null>(null);

  const mutation = useMutation<AiFixResult, Error, string>({
    mutationKey: ["ai-fix"],
    mutationFn: async (sessionId: string) => {
      // Double-submission protection
      if (pendingFixes.has(sessionId)) {
        throw new Error("Analysis already in progress for this session");
      }

      pendingFixes.add(sessionId);

      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const { data } = await apiClient.post<AiFixResult>(
          `/api/v1/sessions/${sessionId}/fix`,
          {},
          {
            signal: controller.signal,
            timeout: AI_FIX_TIMEOUT,
          }
        );
        return data;
      } finally {
        pendingFixes.delete(sessionId);
        abortControllerRef.current = null;
      }
    },
    onSuccess: (result, sessionId) => {
      // Update the session in cache to include the ai_fix in metadata
      queryClient.setQueryData(
        queryKeys.sessions.detail(sessionId),
        (old: ClawSession | undefined) => {
          if (!old) return old;
          return {
            ...old,
            metadata: {
              ...old.metadata,
              ai_fix: result,
            },
          };
        }
      );
      toast.success("Analysis complete", {
        description: "AI has analyzed the session and provided a fix.",
      });
    },
    onError: (error: Error, sessionId) => {
      // Check if it's a rate limit error
      if (error.message.includes("429") || error.message.includes("Rate limit")) {
        toast.error("Rate limit reached", {
          description: "You can perform up to 10 analyses per hour.",
          duration: 10_000,
        });
      } else if (error.message.includes("already in progress")) {
        toast.info("Analysis in progress", {
          description: "Please wait for the current analysis to complete.",
        });
      } else {
        handleApiError(error, { context: "AI analysis failed" });
      }
    },
  });

  // Wrapper to check if mutation is pending for a specific session
  const isPending = useCallback((sessionId: string) => {
    return pendingFixes.has(sessionId) || mutation.isPending;
  }, [mutation.isPending]);

  return {
    ...mutation,
    isPendingFor: isPending,
  };
}

export function useAIFixDeeper() {
  const queryClient = useQueryClient();
  const abortControllerRef = useRef<AbortController | null>(null);

  const mutation = useMutation<AiFixResult, Error, { sessionId: string; followUp: string }>({
    mutationKey: ["ai-fix", "deeper"],
    mutationFn: async ({ sessionId, followUp }) => {
      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const { data } = await apiClient.post<AiFixResult>(
          `/api/v1/sessions/${sessionId}/fix/deeper`,
          { follow_up: followUp },
          {
            signal: controller.signal,
            timeout: AI_FIX_TIMEOUT,
          }
        );
        return data;
      } finally {
        abortControllerRef.current = null;
      }
    },
    onSuccess: (result, { sessionId }) => {
      // For deeper analysis, we don't update the session metadata cache
      // (it's not stored per spec), but we could add it to a separate query key
      // if we wanted to persist deeper results
      toast.success("Follow-up analysis complete");
    },
    onError: (error: Error) => {
      handleApiError(error, { context: "Follow-up analysis failed" });
    },
  });

  return mutation;
}