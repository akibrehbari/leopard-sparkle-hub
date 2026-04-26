/**
 * Browser-side TanStack Query hooks. These talk to our internal /api/infloww/*
 * route handlers, NEVER to openapi.infloww.com directly — that would leak the
 * API key into the page bundle.
 */
"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import type {
  InflowwCreator,
  InflowwEnvelope,
  InflowwLink,
  InflowwLinkFan,
  InflowwLinkType,
  InflowwRefund,
  InflowwTransaction,
} from "./types";

/* -------------------------------------------------------------------------- */
/*  Local fetch helper                                                        */
/* -------------------------------------------------------------------------- */

async function fetchJson<T>(url: string): Promise<T> {
  const resp = await fetch(url, { credentials: "same-origin" });
  if (!resp.ok) {
    let detail = "";
    try {
      const body = (await resp.json()) as { error?: string };
      detail = body?.error ?? "";
    } catch {
      // ignore
    }
    throw new Error(
      detail || `Request failed (${resp.status}) for ${new URL(url, "http://x").pathname}`,
    );
  }
  return (await resp.json()) as T;
}

function buildUrl(base: string, params: Record<string, unknown>): string {
  const url = new URL(base, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    url.searchParams.set(k, String(v));
  }
  return url.pathname + url.search;
}

/* -------------------------------------------------------------------------- */
/*  Hooks                                                                     */
/* -------------------------------------------------------------------------- */

export function useCreators(opts: { limit?: number } = {}) {
  return useQuery({
    queryKey: ["infloww", "creators", opts],
    queryFn: () =>
      fetchJson<InflowwEnvelope<InflowwCreator>>(
        buildUrl("/api/infloww/creators", { limit: opts.limit ?? 50 }),
      ),
    staleTime: 5 * 60 * 1000,
  });
}

export interface UseTransactionsOptions {
  creatorId: string | null;
  startTime?: string | number;
  endTime?: string | number;
  limit?: number;
  /** When true, fetch every page (capped server-side at 20) and return a flat list. */
  all?: boolean;
}

export function useTransactions(opts: UseTransactionsOptions) {
  return useQuery({
    enabled: Boolean(opts.creatorId),
    queryKey: ["infloww", "transactions", opts],
    queryFn: () =>
      fetchJson<InflowwEnvelope<InflowwTransaction>>(
        buildUrl("/api/infloww/transactions", {
          creatorId: opts.creatorId,
          startTime: opts.startTime,
          endTime: opts.endTime,
          limit: opts.limit,
          all: opts.all ? "1" : undefined,
        }),
      ),
    staleTime: 60 * 1000,
  });
}

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
      fetchJson<InflowwEnvelope<InflowwRefund>>(
        buildUrl("/api/infloww/refunds", {
          creatorId: opts.creatorId,
          startTime: opts.startTime,
          endTime: opts.endTime,
          limit: opts.limit,
          all: opts.all ? "1" : undefined,
        }),
      ),
    staleTime: 60 * 1000,
  });
}

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
      fetchJson<InflowwEnvelope<InflowwLink>>(
        buildUrl("/api/infloww/links", {
          creatorId: opts.creatorId,
          linkType: opts.linkType ?? "TRIAL",
          startTime: opts.startTime,
          endTime: opts.endTime,
          limit: opts.limit,
        }),
      ),
    staleTime: 5 * 60 * 1000,
  });
}

export interface UseLinkFansOptions {
  creatorId: string | null;
  linkId: string | null;
  linkType: InflowwLinkType;
  limit?: number;
}

/* -------------------------------------------------------------------------- */
/*  Aggregate hooks (cross-creator)                                           */
/* -------------------------------------------------------------------------- */

export interface UseAllCreatorTransactionsOptions {
  /** Pass the list of connected creator IDs from /v1/creators. */
  creatorIds: string[];
  startTime?: string | number;
  endTime?: string | number;
}

export interface UseAllCreatorTransactionsResult {
  /** Per-creator results, parallel to `creatorIds`. */
  byCreator: { creatorId: string; transactions: InflowwTransaction[] }[];
  /** Flattened list of all transactions across creators. */
  transactions: InflowwTransaction[];
  /** Number of per-creator queries currently in flight. */
  loadingCount: number;
  /** Number of per-creator queries that errored. */
  errorCount: number;
  /** Total queries dispatched. */
  totalCount: number;
  /** True while any creator's data is still loading. */
  isLoading: boolean;
  /** True when every creator either resolved or errored. */
  isSettled: boolean;
}

/**
 * Fan out one /v1/transactions request per creator and combine the results.
 * Each creator gets its own React Query cache entry so partial failures don't
 * tank the whole page, and refetching a single creator doesn't redownload
 * everyone else.
 */
export function useAllCreatorTransactions(
  opts: UseAllCreatorTransactionsOptions,
): UseAllCreatorTransactionsResult {
  const { creatorIds, startTime, endTime } = opts;

  const queries = useQueries({
    queries: creatorIds.map((id) => ({
      queryKey: ["infloww", "transactions", { creatorId: id, startTime, endTime, all: true }],
      queryFn: () =>
        fetchJson<InflowwEnvelope<InflowwTransaction>>(
          buildUrl("/api/infloww/transactions", {
            creatorId: id,
            startTime,
            endTime,
            all: "1",
          }),
        ),
      staleTime: 60 * 1000,
      enabled: Boolean(id),
    })),
  });

  const byCreator = queries.map((q, i) => ({
    creatorId: creatorIds[i],
    transactions: q.data?.data?.list ?? [],
  }));
  const transactions = byCreator.flatMap((b) => b.transactions);
  const loadingCount = queries.filter((q) => q.isLoading).length;
  const errorCount = queries.filter((q) => q.isError).length;
  const totalCount = queries.length;
  const isLoading = loadingCount > 0;
  const isSettled = totalCount > 0 && loadingCount === 0;

  return {
    byCreator,
    transactions,
    loadingCount,
    errorCount,
    totalCount,
    isLoading,
    isSettled,
  };
}

export function useLinkFans(opts: UseLinkFansOptions) {
  return useQuery({
    enabled: Boolean(opts.creatorId && opts.linkId),
    queryKey: ["infloww", "linkfans", opts],
    queryFn: () =>
      fetchJson<InflowwEnvelope<InflowwLinkFan>>(
        buildUrl("/api/infloww/linkfans", {
          creatorId: opts.creatorId,
          linkId: opts.linkId,
          linkType: opts.linkType,
          limit: opts.limit,
        }),
      ),
    staleTime: 5 * 60 * 1000,
  });
}
