import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { CreateWorkerBody, UpdateWorkerBody, Worker } from "./types";

const WORKERS_KEY = ["workers"] as const;

export function useWorkers(options?: { enabled?: boolean }) {
  return useQuery<Worker[]>({
    queryKey: WORKERS_KEY,
    queryFn: async () => {
      const { data } = await api.get<{ data: Worker[] }>("/api/workers");
      return data.data;
    },
    enabled: options?.enabled ?? true,
  });
}

export function useCreateWorker() {
  const qc = useQueryClient();
  return useMutation<Worker, Error, CreateWorkerBody>({
    mutationFn: async (body) => {
      const { data } = await api.post<{ data: Worker }>("/api/workers", body);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: WORKERS_KEY }),
  });
}

export function useUpdateWorker() {
  const qc = useQueryClient();
  return useMutation<Worker, Error, { id: string; body: UpdateWorkerBody }>({
    mutationFn: async ({ id, body }) => {
      const { data } = await api.patch<{ data: Worker }>(`/api/workers/${id}`, body);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: WORKERS_KEY }),
  });
}

export function useDeleteWorker() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await api.delete(`/api/workers/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: WORKERS_KEY }),
  });
}
