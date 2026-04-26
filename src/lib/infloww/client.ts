/**
 * Server-only HTTP client for the Infloww OpenAPI.
 *
 * Why this exists:
 * - The API key MUST never reach the browser, so all calls go through this
 *   module which is only imported by Next.js Route Handlers.
 * - Centralizes auth headers, retries, error normalization, and pagination.
 *
 * The `import "server-only"` at the top causes the build to fail loudly if a
 * client component ever imports this module by mistake.
 */
import "server-only";

import type {
  InflowwCreator,
  InflowwEnvelope,
  InflowwLink,
  InflowwLinkFan,
  InflowwLinkFansQuery,
  InflowwLinkType,
  InflowwLinksQuery,
  InflowwListQuery,
  InflowwRefund,
  InflowwRefundsQuery,
  InflowwTransaction,
  InflowwTransactionsQuery,
  InflowwCampaignLink,
  InflowwTrialLink,
  InflowwTrackingLink,
} from "./types";

const BASE_URL = "https://openapi.infloww.com";

/**
 * Thrown for any non-2xx response from the Infloww API. Callers should catch
 * this and translate to an HTTP response in their Route Handler.
 */
export class InflowwApiError extends Error {
  status: number;
  body: unknown;
  requestId: string | null;
  constructor(args: {
    status: number;
    message: string;
    body: unknown;
    requestId: string | null;
  }) {
    super(args.message);
    this.name = "InflowwApiError";
    this.status = args.status;
    this.body = args.body;
    this.requestId = args.requestId;
  }
}

function readEnv() {
  // Trim defensively: pasting into Vercel's env UI is a common source of
  // stray whitespace / trailing newlines that produce silent 401s upstream.
  const apiKey = process.env.INFLOW_API_KEY?.trim();
  const oid = process.env.INFLOW_AGENCY_OID?.trim();
  if (!apiKey || !oid) {
    throw new InflowwApiError({
      status: 500,
      message:
        "Infloww credentials are missing. Set INFLOW_API_KEY and INFLOW_AGENCY_OID in your environment.",
      body: null,
      requestId: null,
    });
  }
  return { apiKey, oid };
}

/**
 * Low-level GET wrapper. Adds auth headers, retries 429/5xx with exponential
 * backoff, and unwraps JSON.
 */
async function get<T>(
  path: string,
  query: Record<string, unknown> = {},
  options: { retries?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const { apiKey, oid } = readEnv();
  const { retries = 2, signal } = options;

  const url = new URL(BASE_URL + path);
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    url.searchParams.set(k, String(v));
  }

  let lastError: InflowwApiError | null = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let resp: Response;
    try {
      resp = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "x-oid": oid,
          Accept: "application/json",
        },
        cache: "no-store",
        signal,
      });
    } catch (err) {
      lastError = new InflowwApiError({
        status: 502,
        message: `Network error calling Infloww: ${(err as Error).message}`,
        body: null,
        requestId: null,
      });
      if (attempt < retries) {
        await sleep(backoffMs(attempt));
        continue;
      }
      throw lastError;
    }

    const requestId = resp.headers.get("x-request-id");

    if (resp.ok) {
      return (await resp.json()) as T;
    }

    const text = await resp.text();
    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = text.slice(0, 400);
    }

    // Retry on rate-limit / server errors.
    const retryable = resp.status === 429 || resp.status >= 500;
    lastError = new InflowwApiError({
      status: resp.status,
      message:
        (body as { errorMessage?: string; message?: string })?.errorMessage ??
        (body as { errorMessage?: string; message?: string })?.message ??
        `Infloww API error (HTTP ${resp.status})`,
      body,
      requestId,
    });
    if (retryable && attempt < retries) {
      await sleep(backoffMs(attempt));
      continue;
    }
    throw lastError;
  }
  throw lastError ?? new InflowwApiError({ status: 500, message: "Unknown", body: null, requestId: null });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number) {
  // 400ms, 1.2s, 3.6s — capped, plus a small jitter.
  return Math.min(3600, 400 * Math.pow(3, attempt)) + Math.floor(Math.random() * 200);
}

/* -------------------------------------------------------------------------- */
/*  Resource fetchers                                                         */
/* -------------------------------------------------------------------------- */

export async function listCreators(
  query: InflowwListQuery = {},
): Promise<InflowwEnvelope<InflowwCreator>> {
  return get<InflowwEnvelope<InflowwCreator>>("/v1/creators", { ...query });
}

export async function listTransactions(
  query: InflowwTransactionsQuery,
): Promise<InflowwEnvelope<InflowwTransaction>> {
  return get<InflowwEnvelope<InflowwTransaction>>("/v1/transactions", { ...query });
}

export async function listRefunds(
  query: InflowwRefundsQuery,
): Promise<InflowwEnvelope<InflowwRefund>> {
  return get<InflowwEnvelope<InflowwRefund>>("/v1/refunds", { ...query });
}

/**
 * Fetch links for a given creator and linkType. The response shape varies by
 * linkType; we tag each item with `linkKind` for downstream pattern matching.
 */
export async function listLinks(
  query: InflowwLinksQuery,
): Promise<InflowwEnvelope<InflowwLink>> {
  const linkType: InflowwLinkType = query.linkType ?? "TRIAL";
  const raw = await get<InflowwEnvelope<unknown>>("/v1/links", {
    ...query,
    linkType,
  });
  const tagged: InflowwLink[] = (raw.data?.list ?? []).map((item) =>
    tagLink(item, linkType),
  );
  return {
    ...raw,
    data: { ...raw.data, list: tagged },
  };
}

function tagLink(item: unknown, linkType: InflowwLinkType): InflowwLink {
  const base = item as Record<string, unknown>;
  if (linkType === "CAMPAIGN") {
    return { linkKind: "CAMPAIGN", ...(base as object) } as InflowwCampaignLink;
  }
  if (linkType === "TRIAL") {
    return { linkKind: "TRIAL", ...(base as object) } as InflowwTrialLink;
  }
  return { linkKind: "TRACKING", ...(base as object) } as InflowwTrackingLink;
}

export async function listLinkFans(
  query: InflowwLinkFansQuery,
): Promise<InflowwEnvelope<InflowwLinkFan>> {
  return get<InflowwEnvelope<InflowwLinkFan>>("/v1/linkfans", { ...query });
}

/**
 * Fetch all pages of a paginated endpoint. Useful for derived analytics where
 * we need the full data set (e.g. revenue over the last 30 days).
 *
 * Bounded by `maxPages` to prevent runaway loops if `hasMore` is misreported.
 */
export async function paginate<T>(
  fetcher: (cursor: string | number | undefined) => Promise<InflowwEnvelope<T>>,
  options: { maxPages?: number } = {},
): Promise<T[]> {
  const { maxPages = 20 } = options;
  const out: T[] = [];
  let cursor: string | number | undefined;
  for (let i = 0; i < maxPages; i += 1) {
    const resp = await fetcher(cursor);
    const list = resp.data?.list ?? [];
    out.push(...list);
    if (!resp.hasMore || !resp.cursor) break;
    cursor = resp.cursor;
  }
  return out;
}
