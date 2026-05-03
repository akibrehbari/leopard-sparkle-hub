"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { useState } from "react";

/**
 * Cache-friendly defaults for the dashboard:
 *   - staleTime 1 min: no background refetches during normal navigation
 *   - gcTime 30 min: keep results in memory so tabbing between creators is
 *     instant
 *   - refetchOnWindowFocus off: this is an internal dashboard, not a stock
 *     ticker — re-fetching every time the tab regains focus is wasted I/O
 *     against Mongo
 *   - retry: bail immediately on any 4xx (429 rate-limit, 401 auth, etc.) so
 *     we don't make things worse; one retry on 5xx/network with backoff
 *
 * We deliberately do NOT mount `next-themes` here. The app is dark-only
 * (the `class="dark"` is set on <html> in app/layout.tsx) and `next-themes`
 * injects an inline `<script>` that React 19 / Next.js 16 warns about.
 * Skipping the provider sidesteps the warning and a runtime dependency we
 * weren't actually using for theme switching.
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: (failureCount, error) => {
          const status = (error as { status?: unknown } | null)?.status;
          if (typeof status === "number" && status >= 400 && status < 500) {
            return false;
          }
          return failureCount < 1;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
      },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {children}
      </TooltipProvider>
    </QueryClientProvider>
  );
}
