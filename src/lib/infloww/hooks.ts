/**
 * Browser-side TanStack Query hooks. These talk to our internal /api/infloww/*
 * route handlers, NEVER to openapi.infloww.com directly — that would leak the
 * API key into the page bundle.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
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

/**
 * Error thrown by `fetchJson` when the proxy responds with a non-2xx. The
 * `status` is plumbed through so the QueryClient retry policy can bail on
 * 4xx (429, 401, etc.) instead of hammering Infloww.
 */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

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
    const path = new URL(url, "http://x").pathname;
    throw new ApiError(
      detail || `Request failed (${resp.status}) for ${path}`,
      resp.status,
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
    // Connected creator list rarely changes — keep it cached for 15 min.
    staleTime: 15 * 60 * 1000,
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
    // Inherits 1-min staleTime + 30-min gcTime from QueryClient defaults.
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
    // Inherits 1-min staleTime + 30-min gcTime from QueryClient defaults.
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
