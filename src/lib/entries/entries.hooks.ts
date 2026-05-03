"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { entriesService } from "./entries.service";
import type { ListEntriesParams, UpsertEntryBody } from "./types";
import type { PlatformKey } from "@/lib/platforms/registry";

const ROOT = ["entries"] as const;
const listKey = (params: ListEntriesParams) => [...ROOT, "list", params] as const;

export function useEntries(params: ListEntriesParams = {}, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: listKey(params),
    queryFn: () => entriesService.list(params),
    enabled: opts.enabled ?? true,
  });
}

export function useUpsertEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpsertEntryBody) => entriesService.upsert(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ROOT }),
  });
}

export function useDeleteEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      influencerId: string;
      platform: PlatformKey;
      weekKey: string;
    }) => entriesService.remove(params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ROOT }),
  });
}
