"use client";

import { useQuery } from "@tanstack/react-query";
import { platformsService } from "./platforms.service";

export function usePlatforms() {
  return useQuery({
    queryKey: ["platforms"],
    queryFn: () => platformsService.list(),
    // Schemas only change with code deploys; safe to cache aggressively.
    staleTime: Infinity,
  });
}
