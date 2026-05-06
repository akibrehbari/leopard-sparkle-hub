"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { agenciesService } from "./agencies.service";
import type { CreateAgencyBody, UpdateAgencyBody } from "./types";

const LIST_KEY = ["agencies", "list"] as const;
const SUMMARIES_KEY = ["agencies", "summaries"] as const;
const ACTIVE_KEY = ["agencies", "active"] as const;

export function useAgencies(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: () => agenciesService.list(),
    enabled: options.enabled ?? true,
  });
}

export function useAgencySummaries(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: SUMMARIES_KEY,
    queryFn: () => agenciesService.listSummaries(),
    enabled: options.enabled ?? true,
  });
}

/**
 * Fetch the full agency record for the session's active agency. Returns
 * `null` when no agency is selected. The topbar uses this to render the
 * outbound social/website link icons.
 */
export function useActiveAgency(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ACTIVE_KEY,
    queryFn: () => agenciesService.getActive(),
    enabled: options.enabled ?? true,
  });
}

export function useCreateAgency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAgencyBody) => agenciesService.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      qc.invalidateQueries({ queryKey: SUMMARIES_KEY });
      qc.invalidateQueries({ queryKey: ACTIVE_KEY });
    },
  });
}

export function useUpdateAgency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateAgencyBody }) =>
      agenciesService.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      qc.invalidateQueries({ queryKey: SUMMARIES_KEY });
      qc.invalidateQueries({ queryKey: ACTIVE_KEY });
    },
  });
}

export function useDeleteAgency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, confirmName }: { id: string; confirmName: string }) =>
      agenciesService.remove(id, confirmName),
    onSuccess: () => {
      // A delete cascades — refresh effectively everything that's tenant-scoped.
      qc.invalidateQueries({ queryKey: LIST_KEY });
      qc.invalidateQueries({ queryKey: SUMMARIES_KEY });
      qc.invalidateQueries({ queryKey: ACTIVE_KEY });
      qc.invalidateQueries({ queryKey: ["influencers"] });
      qc.invalidateQueries({ queryKey: ["subreddits"] });
      qc.invalidateQueries({ queryKey: ["entries"] });
    },
  });
}
