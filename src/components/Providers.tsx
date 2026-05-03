"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { useState } from "react";

/**
 * Cache-friendly defaults for the dashboard:
 *   - staleTime 1 min: no background refetches during normal navigation
 *   - gcTime 30 min: keep results in memory so tabbing between creators is
 *     instant
 *   - refetchOnWindowFocus off: this is an internal dashboard, not a stock
 *     ticker — pulling fresh data every time the tab regains focus just burns
 *     Infloww quota
 *   - retry: bail immediately on any 4xx (429 rate-limit, 401 auth, etc.) so
 *     we don't make things worse; one retry on 5xx/network with backoff
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
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          {children}
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
