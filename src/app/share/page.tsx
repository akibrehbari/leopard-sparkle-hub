/**
 * Public read-only multi-model dashboard.
 *
 * URL: /share?ids=a,b,c&selected=a&range=30d
 *
 * Server Component that calls the share controller directly (no HTTP self-call)
 * and hands the resulting payload to the client renderer. Middleware bypasses
 * this path; the influencer ObjectIds in the URL are the credential.
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
import { parseShareParams } from "@/lib/share/url";
import { ShareDashboard } from "./ShareDashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    ids?: string;
    selected?: string;
    range?: string;
  }>;
}

export default async function MultiSharePage({ searchParams }: Props) {
  const sp = await searchParams;
  const parts = parseShareParams(sp);
  if (!parts) notFound();

  try {
    const payload = await shareController.buildPayload({
      influencerId: parts.selected,
      range: parts.range,
      rosterIds: parts.ids,
    });
    return <ShareDashboard payload={payload} />;
  } catch (err) {
    if (err instanceof ShareNotFoundError) notFound();
    throw err;
  }
}
