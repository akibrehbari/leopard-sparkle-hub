/**
 * Browser-side Infloww service class.
 *
 * Layer contract (per api-architecture rule):
 *   Component → hooks.ts → InflowwService (class) → api.ts (axios instance)
 *
 * BASE_PATH is the sub-path under the origin that this service owns. The axios
 * instance carries only the origin (e.g. http://localhost:3000), so every
 * request resolves to: origin + BASE_PATH + endpoint.
 *
 * Rules:
 *   - One method per proxy endpoint.
 *   - Accepts typed params, returns typed data.
 *   - Throws ApiError on non-2xx (mapped by the axios interceptor in api.ts).
 *   - No React or React Query dependencies.
 */

import type {
  InflowwCreator,
  InflowwEnvelope,
  InflowwLink,
  InflowwLinkFan,
  InflowwLinkType,
  InflowwRefund,
  InflowwTransaction,
} from "./types";
import api from "@/lib/api";

/* -------------------------------------------------------------------------- */
/*  Param types                                                               */
/* -------------------------------------------------------------------------- */

export interface GetCreatorsParams {
  limit?: number;
}

export interface GetTransactionsParams {
  creatorId: string;
  startTime?: string | number;
  endTime?: string | number;
  limit?: number;
  /** Pass true to fetch all pages server-side (capped at 20). */
  all?: boolean;
}

export interface GetRefundsParams {
  creatorId: string;
  startTime?: string | number;
  endTime?: string | number;
  limit?: number;
  all?: boolean;
}

export interface GetLinksParams {
  creatorId: string;
  linkType?: InflowwLinkType;
  startTime?: string | number;
  endTime?: string | number;
  limit?: number;
}

export interface GetLinkFansParams {
  creatorId: string;
  linkId: string;
  linkType: InflowwLinkType;
  limit?: number;
}

/* -------------------------------------------------------------------------- */
/*  Service class                                                             */
/* -------------------------------------------------------------------------- */

class InflowwService {
  /** Sub-path under the axios instance's origin for all Infloww proxy routes. */
  private static readonly BASE_PATH = "/api/infloww";

  private url(endpoint: string): string {
    return `${InflowwService.BASE_PATH}${endpoint}`;
  }

  private buildParams(params: Record<string, unknown>): URLSearchParams {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === "") continue;
      sp.set(k, String(v));
    }
    return sp;
  }

  async getCreators(
    params: GetCreatorsParams = {},
  ): Promise<InflowwEnvelope<InflowwCreator>> {
    const sp = this.buildParams({ limit: params.limit ?? 50 });
    const { data } = await api.get<InflowwEnvelope<InflowwCreator>>(
      `${this.url("/creators")}?${sp}`,
    );
    return data;
  }

  async getTransactions(
    params: GetTransactionsParams,
  ): Promise<InflowwEnvelope<InflowwTransaction>> {
    const sp = this.buildParams({
      creatorId: params.creatorId,
      startTime: params.startTime,
      endTime: params.endTime,
      limit: params.limit,
      all: params.all ? "1" : undefined,
    });
    const { data } = await api.get<InflowwEnvelope<InflowwTransaction>>(
      `${this.url("/transactions")}?${sp}`,
    );
    return data;
  }

  async getRefunds(
    params: GetRefundsParams,
  ): Promise<InflowwEnvelope<InflowwRefund>> {
    const sp = this.buildParams({
      creatorId: params.creatorId,
      startTime: params.startTime,
      endTime: params.endTime,
      limit: params.limit,
      all: params.all ? "1" : undefined,
    });
    const { data } = await api.get<InflowwEnvelope<InflowwRefund>>(
      `${this.url("/refunds")}?${sp}`,
    );
    return data;
  }

  async getLinks(
    params: GetLinksParams,
  ): Promise<InflowwEnvelope<InflowwLink>> {
    const sp = this.buildParams({
      creatorId: params.creatorId,
      linkType: params.linkType ?? "TRIAL",
      startTime: params.startTime,
      endTime: params.endTime,
      limit: params.limit,
    });
    const { data } = await api.get<InflowwEnvelope<InflowwLink>>(
      `${this.url("/links")}?${sp}`,
    );
    return data;
  }

  async getLinkFans(
    params: GetLinkFansParams,
  ): Promise<InflowwEnvelope<InflowwLinkFan>> {
    const sp = this.buildParams({
      creatorId: params.creatorId,
      linkId: params.linkId,
      linkType: params.linkType,
      limit: params.limit,
    });
    const { data } = await api.get<InflowwEnvelope<InflowwLinkFan>>(
      `${this.url("/linkfans")}?${sp}`,
    );
    return data;
  }
}

/** Singleton instance — import this directly in hooks.ts. */
export const inflowwService = new InflowwService();
