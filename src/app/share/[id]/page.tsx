/**
 * Public read-only dashboard.
 *
 * URL: /share/<influencerId>?range=7d|30d|90d
 *
 * This page is a Server Component that calls the share controller directly
 * (no HTTP self-call) and hands the resulting payload to the client renderer.
 * Middleware bypasses this path; the influencer ObjectId is the credential.
 *
 * Data is always live — every request re-queries Mongo. Rolling windows
 * ("last 30 days") are anchored to the request time, not when the link was
 * originally generated.
 */
import { notFound } from "next/navigation";

import {
  ShareNotFoundError,
  shareController,
} from "@/app/api/share/share.controller";
import {
  DASHBOARD_RANGES,
  type DashboardRange,
} from "@/lib/utils/range";
import { ShareDashboard } from "./ShareDashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string }>;
}

function parseRange(raw: string | undefined): DashboardRange {
  if (raw && (DASHBOARD_RANGES as readonly string[]).includes(raw)) {
    return raw as DashboardRange;
  }
  return "30d";
}

export default async function SharePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { range: rawRange } = await searchParams;
  const range = parseRange(rawRange);

  try {
    const payload = await shareController.buildPayload({
      influencerId: id,
      range,
    });
    return <ShareDashboard payload={payload} />;
  } catch (err) {
    if (err instanceof ShareNotFoundError) notFound();
    throw err;
  }
}
