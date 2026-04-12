"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { queryKeys, AiFixResult, ClawSession } from "@/lib/types";
import { toast } from "sonner";

export function useAIFix() {
  const queryClient = useQueryClient();

  return useMutation<AiFixResult, Error, string>({
    mutationKey: ["ai-fix"],
    mutationFn: async (sessionId: string) => {
      const { data } = await apiClient.post<AiFixResult>(
        `/api/v1/sessions/${sessionId}/fix`
      );
      return data;
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
    },
    onError: (error: Error) => {
      // Check if it's a rate limit error
      if (error.message.includes("429") || error.message.includes("Rate limit")) {
        toast.error("Rate limit reached", {
          description: "You can perform up to 10 analyses per hour.",
          duration: 10_000,
        });
      } else {
        toast.error("Analysis failed", {
          description: error.message,
        });
      }
    },
  });
}

export function useAIFixDeeper() {
  const queryClient = useQueryClient();

  return useMutation<AiFixResult, Error, { sessionId: string; followUp: string }>({
    mutationKey: ["ai-fix", "deeper"],
    mutationFn: async ({ sessionId, followUp }) => {
      const { data } = await apiClient.post<AiFixResult>(
        `/api/v1/sessions/${sessionId}/fix/deeper`,
        { follow_up: followUp }
      );
      return data;
    },
    onSuccess: (result, { sessionId }) => {
      // For deeper analysis, we don't update the session metadata cache
      // (it's not stored per spec), but we could add it to a separate query key
      // if we wanted to persist deeper results
    },
    onError: (error: Error) => {
      toast.error("Follow-up analysis failed", {
        description: error.message,
      });
    },
  });
}