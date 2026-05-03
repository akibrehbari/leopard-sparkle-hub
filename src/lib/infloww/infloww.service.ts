/**
 * Browser-side Infloww service functions.
 *
 * One function per proxy endpoint. Each function:
 *   - Accepts typed query parameters.
 *   - Calls the axios instance from api.ts (NOT openapi.infloww.com).
 *   - Returns typed data; throws ApiError on non-2xx (mapped by interceptor).
 *   - Knows nothing about React or React Query.
 *
 * Imported by infloww.hooks.ts (React Query wrappers).
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
import api from "./api";

/* -------------------------------------------------------------------------- */
/*  Shared URL builder                                                        */
/* -------------------------------------------------------------------------- */

function buildParams(params: Record<string, unknown>): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  return sp;
}

/* -------------------------------------------------------------------------- */
/*  Service functions                                                         */
/* -------------------------------------------------------------------------- */

export interface GetCreatorsParams {
  limit?: number;
}

export async function getCreators(
  params: GetCreatorsParams = {},
): Promise<InflowwEnvelope<InflowwCreator>> {
  const sp = buildParams({ limit: params.limit ?? 50 });
  const { data } = await api.get<InflowwEnvelope<InflowwCreator>>(
    `/creators?${sp}`,
  );
  return data;
}

export interface GetTransactionsParams {
  creatorId: string;
  startTime?: string | number;
  endTime?: string | number;
  limit?: number;
  /** Pass true to fetch all pages server-side (capped at 20). */
  all?: boolean;
}

export async function getTransactions(
  params: GetTransactionsParams,
): Promise<InflowwEnvelope<InflowwTransaction>> {
  const sp = buildParams({
    creatorId: params.creatorId,
    startTime: params.startTime,
    endTime: params.endTime,
    limit: params.limit,
    all: params.all ? "1" : undefined,
  });
  const { data } = await api.get<InflowwEnvelope<InflowwTransaction>>(
    `/transactions?${sp}`,
  );
  return data;
}

export interface GetRefundsParams {
  creatorId: string;
  startTime?: string | number;
  endTime?: string | number;
  limit?: number;
  all?: boolean;
}

export async function getRefunds(
  params: GetRefundsParams,
): Promise<InflowwEnvelope<InflowwRefund>> {
  const sp = buildParams({
    creatorId: params.creatorId,
    startTime: params.startTime,
    endTime: params.endTime,
    limit: params.limit,
    all: params.all ? "1" : undefined,
  });
  const { data } = await api.get<InflowwEnvelope<InflowwRefund>>(
    `/refunds?${sp}`,
  );
  return data;
}

export interface GetLinksParams {
  creatorId: string;
  linkType?: InflowwLinkType;
  startTime?: string | number;
  endTime?: string | number;
  limit?: number;
}

export async function getLinks(
  params: GetLinksParams,
): Promise<InflowwEnvelope<InflowwLink>> {
  const sp = buildParams({
    creatorId: params.creatorId,
    linkType: params.linkType ?? "TRIAL",
    startTime: params.startTime,
    endTime: params.endTime,
    limit: params.limit,
  });
  const { data } = await api.get<InflowwEnvelope<InflowwLink>>(`/links?${sp}`);
  return data;
}

export interface GetLinkFansParams {
  creatorId: string;
  linkId: string;
  linkType: InflowwLinkType;
  limit?: number;
}

export async function getLinkFans(
  params: GetLinkFansParams,
): Promise<InflowwEnvelope<InflowwLinkFan>> {
  const sp = buildParams({
    creatorId: params.creatorId,
    linkId: params.linkId,
    linkType: params.linkType,
    limit: params.limit,
  });
  const { data } = await api.get<InflowwEnvelope<InflowwLinkFan>>(
    `/linkfans?${sp}`,
  );
  return data;
}
