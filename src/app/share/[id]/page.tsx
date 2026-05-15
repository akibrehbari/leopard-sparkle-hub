/**
 * Backwards-compat redirect for the legacy single-model share URL.
 *
 * Old URL: /share/<influencerId>?range=30d
 * New URL: /share?ids=<id>&selected=<id>&range=30d
 *
 * Old links operators have already shared keep working. The redirect is a
 * 308 (permanent) so any aggregator that follows them updates its cache.
 */
import { redirect } from "next/navigation";

import { buildShareUrl } from "@/lib/share/url";
import { DASHBOARD_RANGES, type DashboardRange } from "@/lib/utils/range";

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
  return "4w";
}

export default async function LegacySharePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { range: rawRange } = await searchParams;
  const range = parseRange(rawRange);
  redirect(buildShareUrl({ ids: [id], selected: id, range }));
}
