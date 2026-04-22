"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { queryKeys } from "@/lib/types";

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  env: "prod" | "staging" | "dev";
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  status: "active" | "revoked";
}

export interface CreateApiKeyResponse {
  id: string;
  name: string;
  prefix: string;
  env: string;
  key: string;
}

export function useApiKeys() {
  return useQuery<ApiKey[]>({
    queryKey: queryKeys.apiKeys.all,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiKey[]>("/api/v1/api-keys");
      return data;
    },
    staleTime: 60_000,
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();

  return useMutation<CreateApiKeyResponse, Error, { name: string; env: string }>({
    mutationFn: async ({ name, env }) => {
      const { data } = await apiClient.post<CreateApiKeyResponse>("/api/v1/api-keys", { name, env });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all });
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (keyId: string) => {
      const { data } = await apiClient.post(`/api/v1/api-keys/${keyId}/revoke`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all });
    },
  });
}