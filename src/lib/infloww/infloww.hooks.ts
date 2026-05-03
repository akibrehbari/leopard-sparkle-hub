/**
 * Browser-side TanStack Query hooks for the Infloww proxy API.
 *
 * Layer contract (per api-architecture rule):
 *   Component → hooks.ts → infloww.service.ts → api.ts (axios)
 *
 * This file ONLY owns React Query config (queryKey, staleTime, enabled).
 * It contains no fetch/axios calls — those live in infloww.service.ts.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import type { InflowwLinkType } from "./types";
import { inflowwService } from "./infloww.service";

/* -------------------------------------------------------------------------- */
/*  Creators                                                                  */
/* -------------------------------------------------------------------------- */

export function useCreators(opts: { limit?: number } = {}) {
  return useQuery({
    queryKey: ["infloww", "creators", opts],
    queryFn: () => inflowwService.getCreators({ limit: opts.limit }),
    // Creator list rarely changes — 15-min stale window.
    staleTime: 15 * 60 * 1000,
  });
}

/* -------------------------------------------------------------------------- */
/*  Transactions                                                              */
/* -------------------------------------------------------------------------- */

export interface UseTransactionsOptions {
  creatorId: string | null;
  startTime?: string | number;
  endTime?: string | number;
  limit?: number;
  /** When true, fetch every page (capped server-side at 20). */
  all?: boolean;
}

export function useTransactions(opts: UseTransactionsOptions) {
  return useQuery({
    enabled: Boolean(opts.creatorId),
    queryKey: ["infloww", "transactions", opts],
    queryFn: () =>
      inflowwService.getTransactions({
        creatorId: opts.creatorId!,
        startTime: opts.startTime,
        endTime: opts.endTime,
        limit: opts.limit,
        all: opts.all,
      }),
    // Inherits 1-min staleTime + 30-min gcTime from QueryClient defaults.
  });
}

/* -------------------------------------------------------------------------- */
/*  Refunds                                                                   */
/* -------------------------------------------------------------------------- */

export interface UseRefundsOptions {
  creatorId: string | null;
  startTime?: string | number;
  endTime?: string | number;
  limit?: number;
  all?: boolean;
}

export function useRefunds(opts: UseRefundsOptions) {
  return useQuery({
    enabled: Boolean(opts.creatorId),
    queryKey: ["infloww", "refunds", opts],
    queryFn: () =>
      inflowwService.getRefunds({
        creatorId: opts.creatorId!,
        startTime: opts.startTime,
        endTime: opts.endTime,
        limit: opts.limit,
        all: opts.all,
      }),
    // Inherits 1-min staleTime + 30-min gcTime from QueryClient defaults.
  });
}

/* -------------------------------------------------------------------------- */
/*  Links                                                                     */
/* -------------------------------------------------------------------------- */

export interface UseLinksOptions {
  creatorId: string | null;
  linkType?: InflowwLinkType;
  startTime?: string | number;
  endTime?: string | number;
  limit?: number;
}

export function useLinks(opts: UseLinksOptions) {
  return useQuery({
    enabled: Boolean(opts.creatorId),
    queryKey: ["infloww", "links", opts],
    queryFn: () =>
      inflowwService.getLinks({
        creatorId: opts.creatorId!,
        linkType: opts.linkType,
        startTime: opts.startTime,
        endTime: opts.endTime,
        limit: opts.limit,
      }),
    // Links change infrequently — 5-min stale window.
    staleTime: 5 * 60 * 1000,
  });
}

/* -------------------------------------------------------------------------- */
/*  Link fans                                                                 */
/* -------------------------------------------------------------------------- */

export interface UseLinkFansOptions {
  creatorId: string | null;
  linkId: string | null;
  linkType: InflowwLinkType;
  limit?: number;
}

export function useLinkFans(opts: UseLinkFansOptions) {
  return useQuery({
    enabled: Boolean(opts.creatorId && opts.linkId),
    queryKey: ["infloww", "linkfans", opts],
    queryFn: () =>
      inflowwService.getLinkFans({
        creatorId: opts.creatorId!,
        linkId: opts.linkId!,
        linkType: opts.linkType,
        limit: opts.limit,
      }),
    staleTime: 5 * 60 * 1000,
  });
}
