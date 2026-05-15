"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { subredditsService } from "./subreddits.service";
import type {
  CreateSubredditBody,
  UpdateSubredditBody,
  UpsertSubredditSnapshotBody,
} from "./types";

const LIST_KEY = ["subreddits", "list"] as const;
const detailKey = (id: string) => ["subreddits", "detail", id] as const;

export function useSubreddits() {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: () => subredditsService.list(),
  });
}

export function useSubreddit(id: string | null) {
  return useQuery({
    enabled: Boolean(id),
    queryKey: id ? detailKey(id) : ["subreddits", "detail", "none"],
    queryFn: () => subredditsService.get(id!),
  });
}

export function useCreateSubreddit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSubredditBody) => subredditsService.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

export function useUpdateSubreddit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateSubredditBody }) =>
      subredditsService.update(id, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      qc.invalidateQueries({ queryKey: detailKey(vars.id) });
    },
  });
}

export function useDeleteSubreddit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => subredditsService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

export function useUpsertSubredditSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpsertSubredditSnapshotBody) =>
      subredditsService.upsertSnapshot(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}
