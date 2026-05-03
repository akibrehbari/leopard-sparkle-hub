/**
 * Server-side Infloww controller.
 *
 * MVC backend pattern:
 *   route.ts (thin route) → infloww.controller.ts (business logic + upstream calls)
 *
 * This controller replaces the old client.ts + _helpers.ts. It owns:
 *   - Env var reading + auth header construction
 *   - HTTP calls to openapi.infloww.com (with retry + backoff)
 *   - Pagination
 *   - Error mapping to NextResponse
 *   - Query param parsing from NextRequest
 *
 * The `import "server-only"` guard ensures a build error if a client component
 * ever accidentally imports this module.
 */
import "server-only";

import { NextRequest, NextResponse } from "next/server";
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
} from "@/lib/infloww/types";

const BASE_URL = "https://openapi.infloww.com";
const VALID_LINK_TYPES: InflowwLinkType[] = ["CAMPAIGN", "TRIAL", "TRACKING"];

/* -------------------------------------------------------------------------- */
/*  Error class                                                               */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*  Controller                                                                */
/* -------------------------------------------------------------------------- */

class InflowwController {
  /* ---- Env ---- */

  private readEnv() {
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

  /* ---- Low-level HTTP ---- */

  private async get<T>(
    path: string,
    query: Record<string, unknown> = {},
    options: { retries?: number; signal?: AbortSignal } = {},
  ): Promise<T> {
    const { apiKey, oid } = this.readEnv();
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
            Authorization: apiKey,
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
          await this.sleep(this.backoffMs(attempt));
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
        await this.sleep(this.backoffMs(attempt));
        continue;
      }
      throw lastError;
    }
    throw lastError ?? new InflowwApiError({ status: 500, message: "Unknown", body: null, requestId: null });
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private backoffMs(attempt: number) {
    return Math.min(3600, 400 * Math.pow(3, attempt)) + Math.floor(Math.random() * 200);
  }

  /* ---- Pagination ---- */

  private async paginate<T>(
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

  /* ---- Upstream fetchers ---- */

  private async listCreators(
    query: InflowwListQuery = {},
  ): Promise<InflowwEnvelope<InflowwCreator>> {
    return this.get<InflowwEnvelope<InflowwCreator>>("/v1/creators", { ...query });
  }

  private async listTransactions(
    query: InflowwTransactionsQuery,
  ): Promise<InflowwEnvelope<InflowwTransaction>> {
    return this.get<InflowwEnvelope<InflowwTransaction>>("/v1/transactions", { ...query });
  }

  private async listRefunds(
    query: InflowwRefundsQuery,
  ): Promise<InflowwEnvelope<InflowwRefund>> {
    return this.get<InflowwEnvelope<InflowwRefund>>("/v1/refunds", { ...query });
  }

  private async listLinks(
    query: InflowwLinksQuery,
  ): Promise<InflowwEnvelope<InflowwLink>> {
    const linkType: InflowwLinkType = query.linkType ?? "TRIAL";
    const raw = await this.get<InflowwEnvelope<unknown>>("/v1/links", {
      ...query,
      linkType,
    });
    const tagged: InflowwLink[] = (raw.data?.list ?? []).map((item) =>
      this.tagLink(item, linkType),
    );
    return { ...raw, data: { ...raw.data, list: tagged } };
  }

  private async listLinkFans(
    query: InflowwLinkFansQuery,
  ): Promise<InflowwEnvelope<InflowwLinkFan>> {
    return this.get<InflowwEnvelope<InflowwLinkFan>>("/v1/linkfans", { ...query });
  }

  private tagLink(item: unknown, linkType: InflowwLinkType): InflowwLink {
    const base = item as Record<string, unknown>;
    if (linkType === "CAMPAIGN") {
      return { linkKind: "CAMPAIGN", ...(base as object) } as InflowwCampaignLink;
    }
    if (linkType === "TRIAL") {
      return { linkKind: "TRIAL", ...(base as object) } as InflowwTrialLink;
    }
    return { linkKind: "TRACKING", ...(base as object) } as InflowwTrackingLink;
  }

  /* ---- Request helpers ---- */

  private param(sp: URLSearchParams, name: string): string | undefined {
    const v = sp.get(name);
    return v && v.length > 0 ? v : undefined;
  }

  private numParam(sp: URLSearchParams, name: string): number | undefined {
    const v = sp.get(name);
    if (v === null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }

  private requireParam(sp: URLSearchParams, name: string): string {
    const v = this.param(sp, name);
    if (!v) {
      throw new InflowwApiError({
        status: 400,
        message: `Missing required query parameter: ${name}`,
        body: null,
        requestId: null,
      });
    }
    return v;
  }

  /* ---- Error response ---- */

  private errorResponse(err: unknown): NextResponse {
    if (err instanceof InflowwApiError) {
      return NextResponse.json(
        {
          error: err.message,
          upstreamStatus: err.status,
          requestId: err.requestId,
          upstreamBody: err.body,
        },
        { status: err.status >= 400 && err.status < 600 ? err.status : 502 },
      );
    }
    console.error("[infloww controller] unexpected error", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }

  /* ==================================================================== */
  /*  Public route handlers                                                */
  /* ==================================================================== */

  async handleGetCreators(request: NextRequest): Promise<NextResponse> {
    const sp = new URL(request.url).searchParams;
    try {
      const data = await this.listCreators({
        limit: this.numParam(sp, "limit"),
        cursor: this.param(sp, "cursor"),
        platformCode: this.param(sp, "platformCode"),
      });
      return NextResponse.json(data);
    } catch (err) {
      return this.errorResponse(err);
    }
  }

  async handleGetTransactions(request: NextRequest): Promise<NextResponse> {
    const sp = new URL(request.url).searchParams;
    try {
      const creatorId = this.requireParam(sp, "creatorId");
      const startTime = this.param(sp, "startTime");
      const endTime = this.param(sp, "endTime");
      const limit = this.numParam(sp, "limit");
      const fetchAll = this.param(sp, "all") === "1";

      if (fetchAll) {
        const all = await this.paginate((cursor) =>
          this.listTransactions({
            creatorId,
            startTime,
            endTime,
            limit: limit ?? 100,
            cursor,
          }),
        );
        return NextResponse.json({
          data: { list: all },
          hasMore: false,
          cursor: null,
        });
      }

      const data = await this.listTransactions({
        creatorId,
        startTime,
        endTime,
        limit,
        cursor: this.param(sp, "cursor"),
      });
      return NextResponse.json(data);
    } catch (err) {
      return this.errorResponse(err);
    }
  }

  async handleGetRefunds(request: NextRequest): Promise<NextResponse> {
    const sp = new URL(request.url).searchParams;
    try {
      const creatorId = this.requireParam(sp, "creatorId");
      const startTime = this.param(sp, "startTime");
      const endTime = this.param(sp, "endTime");
      const limit = this.numParam(sp, "limit");
      const fetchAll = this.param(sp, "all") === "1";

      if (fetchAll) {
        const all = await this.paginate((cursor) =>
          this.listRefunds({
            creatorId,
            startTime,
            endTime,
            limit: limit ?? 100,
            cursor,
          }),
        );
        return NextResponse.json({
          data: { list: all },
          hasMore: false,
          cursor: null,
        });
      }

      const data = await this.listRefunds({
        creatorId,
        startTime,
        endTime,
        limit,
        cursor: this.param(sp, "cursor"),
      });
      return NextResponse.json(data);
    } catch (err) {
      return this.errorResponse(err);
    }
  }

  async handleGetLinks(request: NextRequest): Promise<NextResponse> {
    const sp = new URL(request.url).searchParams;
    try {
      const creatorId = this.requireParam(sp, "creatorId");
      const linkTypeRaw = this.param(sp, "linkType") ?? "TRIAL";
      if (!VALID_LINK_TYPES.includes(linkTypeRaw as InflowwLinkType)) {
        return NextResponse.json(
          { error: `Invalid linkType. Must be one of: ${VALID_LINK_TYPES.join(", ")}` },
          { status: 400 },
        );
      }
      const data = await this.listLinks({
        creatorId,
        linkType: linkTypeRaw as InflowwLinkType,
        startTime: this.param(sp, "startTime"),
        endTime: this.param(sp, "endTime"),
        limit: this.numParam(sp, "limit"),
        cursor: this.param(sp, "cursor"),
      });
      return NextResponse.json(data);
    } catch (err) {
      return this.errorResponse(err);
    }
  }

  /* ==================================================================== */
  /*  Server-only composers                                                */
  /*                                                                        */
  /*  Used by other server-side controllers (e.g. shareController) that     */
  /*  need raw typed envelopes without going through HTTP. Same pagination  */
  /*  and error semantics as the HTTP handlers, just without the wrapping. */
  /* ==================================================================== */

  async fetchAllTransactions(args: {
    creatorId: string;
    startTime?: string | number;
    endTime?: string | number;
  }): Promise<InflowwTransaction[]> {
    return this.paginate((cursor) =>
      this.listTransactions({
        creatorId: args.creatorId,
        startTime: args.startTime,
        endTime: args.endTime,
        limit: 100,
        cursor,
      }),
    );
  }

  async fetchAllRefunds(args: {
    creatorId: string;
    startTime?: string | number;
    endTime?: string | number;
  }): Promise<InflowwRefund[]> {
    return this.paginate((cursor) =>
      this.listRefunds({
        creatorId: args.creatorId,
        startTime: args.startTime,
        endTime: args.endTime,
        limit: 100,
        cursor,
      }),
    );
  }

  async fetchLinks(args: {
    creatorId: string;
    linkType: InflowwLinkType;
    startTime?: string | number;
    endTime?: string | number;
  }): Promise<InflowwLink[]> {
    const env = await this.listLinks({
      creatorId: args.creatorId,
      linkType: args.linkType,
      startTime: args.startTime,
      endTime: args.endTime,
      limit: 50,
    });
    return env.data?.list ?? [];
  }

  async handleGetLinkFans(request: NextRequest): Promise<NextResponse> {
    const sp = new URL(request.url).searchParams;
    try {
      const creatorId = this.requireParam(sp, "creatorId");
      const linkId = this.requireParam(sp, "linkId");
      const linkTypeRaw = this.requireParam(sp, "linkType");
      if (!VALID_LINK_TYPES.includes(linkTypeRaw as InflowwLinkType)) {
        return NextResponse.json(
          { error: `Invalid linkType. Must be one of: ${VALID_LINK_TYPES.join(", ")}` },
          { status: 400 },
        );
      }
      const data = await this.listLinkFans({
        creatorId,
        linkId,
        linkType: linkTypeRaw as InflowwLinkType,
        limit: this.numParam(sp, "limit"),
        cursor: this.param(sp, "cursor"),
      });
      return NextResponse.json(data);
    } catch (err) {
      return this.errorResponse(err);
    }
  }
}

export const inflowwController = new InflowwController();
