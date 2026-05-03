"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authService, type LoginParams, type SessionUser } from "./auth.service";

const ME_KEY = ["auth", "me"] as const;

export function useSession() {
  return useQuery<SessionUser | null>({
    queryKey: ME_KEY,
    queryFn: () => authService.me(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: LoginParams) => authService.login(params),
    onSuccess: (user) => {
      qc.setQueryData(ME_KEY, user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      qc.setQueryData(ME_KEY, null);
      qc.clear();
    },
  });
}
