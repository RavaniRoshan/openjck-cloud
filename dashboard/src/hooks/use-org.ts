"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { queryKeys } from "@/lib/types";

export interface Org {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  created_at: string;
}

export interface OrgMember {
  id: string;
  user_id: string | null;
  email: string;
  role: "owner" | "admin" | "member";
  status: "active" | "pending";
  invited_by?: string | null;
  created_at: string;
  expires_at?: string | null;
}

export function useOrg() {
  return useQuery<Org>({
    queryKey: queryKeys.org.detail("current"),
    queryFn: async () => {
      const { data } = await apiClient.get<Org>("/api/v1/orgs");
      return data;
    },
    staleTime: 60_000,
  });
}

export function useOrgMembers() {
  return useQuery<OrgMember[]>({
    queryKey: queryKeys.org.members("current"),
    queryFn: async () => {
      const { data } = await apiClient.get<OrgMember[]>("/api/v1/orgs/members");
      return data;
    },
    staleTime: 30_000,
  });
}

export function useUpdateOrg() {
  const queryClient = useQueryClient();

  return useMutation<Org, Error, { name: string }>({
    mutationFn: async (payload) => {
      const { data } = await apiClient.patch<Org>("/api/v1/orgs", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.org.detail("current") });
    },
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();

  return useMutation<OrgMember, Error, { email: string; role?: string }>({
    mutationFn: async (payload) => {
      const { data } = await apiClient.post<OrgMember>("/api/v1/orgs/invite", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.org.members("current") });
    },
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  return useMutation<OrgMember, Error, { memberId: string; role: string }>({
    mutationFn: async ({ memberId, role }) => {
      const { data } = await apiClient.patch<OrgMember>(`/api/v1/orgs/members/${memberId}/role`, { role });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.org.members("current") });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (memberId: string) => {
      const { data } = await apiClient.delete(`/api/v1/orgs/members/${memberId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.org.members("current") });
    },
  });
}
