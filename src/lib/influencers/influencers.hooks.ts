"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { influencersService } from "./influencers.service";
import type {
  CreateInfluencerBody,
  UpdateInfluencerBody,
} from "./types";

const LIST_KEY = ["influencers", "list"] as const;
const detailKey = (id: string) => ["influencers", "detail", id] as const;

export function useInfluencers() {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: () => influencersService.list(),
  });
}

export function useInfluencer(id: string | null) {
  return useQuery({
    enabled: Boolean(id),
    queryKey: id ? detailKey(id) : ["influencers", "detail", "none"],
    queryFn: () => influencersService.get(id!),
  });
}

export function useCreateManualInfluencer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateInfluencerBody) => influencersService.createManual(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

export function useUpdateInfluencer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateInfluencerBody }) =>
      influencersService.update(id, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      qc.invalidateQueries({ queryKey: detailKey(vars.id) });
    },
  });
}

export function useDeleteInfluencer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => influencersService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

export function useSyncInfluencers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => influencersService.sync(),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}
