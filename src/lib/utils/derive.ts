/**
 * Derivation helpers for the manually-tracked platforms.
 *
 * Inputs are weekly entries (one document per influencer × platform × ISO
 * week) as returned by the entries API. Outputs are pure JS arrays / objects
 * suitable for direct rendering in recharts or stat tiles.
 *
 * Two storage conventions to keep in mind:
 *   - count fields are stored as integers and represent absolute totals
 *     "as of week N" when the field is `cumulative: true`. Renderers turn
 *     those into weekly deltas via `deltaSeries`.
 *   - currencyCents fields are integers in cents (per-week, never
 *     cumulative). Renderers convert to dollars at display time.
 */

import type { WeeklyEntry } from "@/lib/entries/types";
import {
  ACQUISITION_PLATFORM_KEYS,
  type AcquisitionPlatformKey,
  onlyFansFieldKey,
} from "@/lib/platforms/registry";
import { centsToUsd } from "@/lib/utils/format";

/* -------------------------------------------------------------------------- */
/*  Indexing helpers                                                          */
/* -------------------------------------------------------------------------- */

/** Build a `weekKey -> entry` index for O(1) lookup during series derivation. */
export function indexEntriesByWeek(
  entries: WeeklyEntry[],
): Map<string, WeeklyEntry> {
  const map = new Map<string, WeeklyEntry>();
  for (const e of entries) map.set(e.weekKey, e);
  return map;
}

/** Sort week keys ascending — they're zero-padded ISO strings, so a string
 *  sort is sufficient (and avoids re-parsing). */
export function sortedWeekKeys(weekKeys: readonly string[]): string[] {
  return [...weekKeys].sort();
}

/* -------------------------------------------------------------------------- */
/*  Cumulative-metric deltas                                                  */
/* -------------------------------------------------------------------------- */

export interface DeltaPoint {
  weekKey: string;
  /** Cumulative value for this week, or null if not entered. */
  cumulative: number | null;
  /** Δ vs the most recent prior entered week, or null when no prior exists. */
  delta: number | null;
}

/**
 * Build a per-week series for a cumulative count field. For each requested
 * week we report:
 *   - cumulative: the entered value (or null if no entry that week)
 *   - delta: current cumulative - most-recent-prior cumulative
 *
 * If the operator skips a week, `delta` falls back to the most recent prior
 * non-null value rather than calling the gap a zero — that matches the
 * intent of "growth since last reading".
 */
export function deltaSeries(
  entries: WeeklyEntry[],
  weekKeys: readonly string[],
  fieldKey: string,
): DeltaPoint[] {
  const byWeek = indexEntriesByWeek(entries);
  const ordered = sortedWeekKeys(weekKeys);
  const out: DeltaPoint[] = [];
  let lastSeen: number | null = null;

  for (const wk of ordered) {
    const entry = byWeek.get(wk);
    const raw = entry?.data?.[fieldKey];
    const cumulative = typeof raw === "number" ? raw : null;
    const delta =
      cumulative !== null && lastSeen !== null ? cumulative - lastSeen : null;
    out.push({ weekKey: wk, cumulative, delta });
    if (cumulative !== null) lastSeen = cumulative;
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/*  Per-week currency series                                                  */
/* -------------------------------------------------------------------------- */

export interface CurrencyPoint {
  weekKey: string;
  /** USD dollars (already converted from cents). null when no entry. */
  usd: number | null;
}

/**
 * Build a per-week USD series for a currencyCents field. Missing weeks
 * surface as null so charts can choose to draw gaps or treat as zero.
 */
export function currencySeries(
  entries: WeeklyEntry[],
  weekKeys: readonly string[],
  fieldKey: string,
): CurrencyPoint[] {
  const byWeek = indexEntriesByWeek(entries);
  return sortedWeekKeys(weekKeys).map((wk) => {
    const raw = byWeek.get(wk)?.data?.[fieldKey];
    return {
      weekKey: wk,
      usd: typeof raw === "number" ? centsToUsd(raw) : null,
    };
  });
}

/* -------------------------------------------------------------------------- */
/*  OnlyFans summary                                                          */
/* -------------------------------------------------------------------------- */

export interface OnlyFansWeekPoint {
  weekKey: string;
  /** Per-source revenue in USD. Always present (0 when missing). */
  revenue: Record<AcquisitionPlatformKey, number>;
  /** Per-source spend in USD. Always present (0 when missing). */
  spend: Record<AcquisitionPlatformKey, number>;
  /** Per-source claims count. Always present (0 when missing). */
  claims: Record<AcquisitionPlatformKey, number>;
  /** Per-source new subscribers count. Always present (0 when missing). */
  subs: Record<AcquisitionPlatformKey, number>;
  /** Sum of per-source revenue. */
  totalRevenue: number;
  /** Sum of per-source spend. */
  totalSpend: number;
  /** Sum of per-source claims. */
  totalClaims: number;
  /** Sum of per-source new subscribers. */
  totalSubs: number;
  net: number;
  /** revenue / spend; null when spend is 0. */
  roas: number | null;
  /** (revenue - spend) / spend * 100; null when spend is 0. */
  roi: number | null;
}

export interface OnlyFansSourceSummary {
  source: AcquisitionPlatformKey;
  revenue: number;
  spend: number;
  claims: number;
  subs: number;
  net: number;
  roas: number | null;
  /** (revenue - spend) / spend * 100; null when spend is 0. */
  roi: number | null;
  /** revenue / subs; null when subs is 0. */
  revenuePerSub: number | null;
  /** spend / subs; null when subs is 0. */
  costPerSub: number | null;
  /** Per-week revenue series (USD) for sparkline rendering. */
  weekly: { weekKey: string; revenue: number; spend: number }[];
}

export interface OnlyFansSummary {
  weeks: OnlyFansWeekPoint[];
  /** Range-wide totals across every week + every source. */
  totals: {
    revenue: number;
    spend: number;
    claims: number;
    subs: number;
    net: number;
    roas: number | null;
    /** (revenue - spend) / spend * 100; null when spend is 0. */
    roi: number | null;
    /** revenue / subs; null when subs is 0. */
    revenuePerSub: number | null;
    /** spend / subs; null when subs is 0. */
    costPerSub: number | null;
  };
  /** One summary per acquisition platform. */
  bySource: OnlyFansSourceSummary[];
}

/**
 * Compose the full OnlyFans dashboard payload from a flat list of
 * onlyfans-platform entries spanning the given weeks.
 */
export function onlyFansSummary(
  entries: WeeklyEntry[],
  weekKeys: readonly string[],
): OnlyFansSummary {
  const byWeek = indexEntriesByWeek(entries);
  const ordered = sortedWeekKeys(weekKeys);

  const sourceTotals: Record<AcquisitionPlatformKey, { revenue: number; spend: number; claims: number; subs: number }> = {
    reddit: { revenue: 0, spend: 0, claims: 0, subs: 0 },
    instagram: { revenue: 0, spend: 0, claims: 0, subs: 0 },
    x: { revenue: 0, spend: 0, claims: 0, subs: 0 },
  };

  const sourceWeekly: Record<AcquisitionPlatformKey, { weekKey: string; revenue: number; spend: number }[]> = {
    reddit: [],
    instagram: [],
    x: [],
  };

  const weeks: OnlyFansWeekPoint[] = ordered.map((wk) => {
    const entry = byWeek.get(wk);
    const data = entry?.data ?? {};

    const revenue: Record<AcquisitionPlatformKey, number> = { reddit: 0, instagram: 0, x: 0 };
    const spend: Record<AcquisitionPlatformKey, number> = { reddit: 0, instagram: 0, x: 0 };
    const claims: Record<AcquisitionPlatformKey, number> = { reddit: 0, instagram: 0, x: 0 };
    const subs: Record<AcquisitionPlatformKey, number> = { reddit: 0, instagram: 0, x: 0 };

    for (const src of ACQUISITION_PLATFORM_KEYS) {
      const r = data[onlyFansFieldKey("revenue", src)];
      const s = data[onlyFansFieldKey("spend", src)];
      const c = data[onlyFansFieldKey("claims", src)];
      const sb = data[onlyFansFieldKey("subs", src)];
      revenue[src] = typeof r === "number" ? centsToUsd(r) : 0;
      spend[src] = typeof s === "number" ? centsToUsd(s) : 0;
      claims[src] = typeof c === "number" ? c : 0;
      subs[src] = typeof sb === "number" ? sb : 0;
      sourceTotals[src].revenue += revenue[src];
      sourceTotals[src].spend += spend[src];
      sourceTotals[src].claims += claims[src];
      sourceTotals[src].subs += subs[src];
      sourceWeekly[src].push({ weekKey: wk, revenue: revenue[src], spend: spend[src] });
    }

    const totalRevenue = revenue.reddit + revenue.instagram + revenue.x;
    const totalSpend = spend.reddit + spend.instagram + spend.x;
    const totalClaims = claims.reddit + claims.instagram + claims.x;
    const totalSubs = subs.reddit + subs.instagram + subs.x;
    const net = totalRevenue - totalSpend;
    const roas = totalSpend > 0 ? totalRevenue / totalSpend : null;
    const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : null;

    return {
      weekKey: wk,
      revenue,
      spend,
      claims,
      subs,
      totalRevenue,
      totalSpend,
      totalClaims,
      totalSubs,
      net,
      roas,
      roi,
    };
  });

  const totalRevenue =
    sourceTotals.reddit.revenue +
    sourceTotals.instagram.revenue +
    sourceTotals.x.revenue;
  const totalSpend =
    sourceTotals.reddit.spend +
    sourceTotals.instagram.spend +
    sourceTotals.x.spend;
  const totalClaims =
    sourceTotals.reddit.claims +
    sourceTotals.instagram.claims +
    sourceTotals.x.claims;
  const totalSubs =
    sourceTotals.reddit.subs +
    sourceTotals.instagram.subs +
    sourceTotals.x.subs;

  return {
    weeks,
    totals: {
      revenue: totalRevenue,
      spend: totalSpend,
      claims: totalClaims,
      subs: totalSubs,
      net: totalRevenue - totalSpend,
      roas: totalSpend > 0 ? totalRevenue / totalSpend : null,
      roi: totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : null,
      revenuePerSub: totalSubs > 0 ? totalRevenue / totalSubs : null,
      costPerSub: totalSubs > 0 ? totalSpend / totalSubs : null,
    },
    bySource: ACQUISITION_PLATFORM_KEYS.map((src) => {
      const r = sourceTotals[src].revenue;
      const s = sourceTotals[src].spend;
      const c = sourceTotals[src].claims;
      const sb = sourceTotals[src].subs;
      return {
        source: src,
        revenue: r,
        spend: s,
        claims: c,
        subs: sb,
        net: r - s,
        roas: s > 0 ? r / s : null,
        roi: s > 0 ? ((r - s) / s) * 100 : null,
        revenuePerSub: sb > 0 ? r / sb : null,
        costPerSub: sb > 0 ? s / sb : null,
        weekly: sourceWeekly[src],
      };
    }),
  };
}

/* -------------------------------------------------------------------------- */
/*  Subscribers & ROI combined series                                         */
/* -------------------------------------------------------------------------- */

export interface SubscribersROIPoint {
  weekKey: string;
  label: string;
  reddit: number | null;
  instagram: number | null;
  x: number | null;
  onlyfans: number | null;
  roi: number | null;
}

/**
 * Build a per-week series combining all-platform follower/subscriber counts
 * with the OnlyFans ROI %. Used by the SubscribersROIChart component.
 *
 * - reddit/instagram/x: cumulative followers
 * - onlyfans: cumulative subscribers (the new `subscribers` field)
 * - roi: (revenue - spend) / spend * 100 from onlyfans entries
 */
export function subscribersROISeries(
  entries: WeeklyEntry[],
  weekKeys: readonly string[],
  weekLabelFn: (wk: string) => string,
): SubscribersROIPoint[] {
  const ordered = sortedWeekKeys(weekKeys);

  const redditEntries = entries.filter((e) => e.platform === "reddit");
  const instagramEntries = entries.filter((e) => e.platform === "instagram");
  const xEntries = entries.filter((e) => e.platform === "x");
  const ofEntries = entries.filter((e) => e.platform === "onlyfans");

  const redditSeries = deltaSeries(redditEntries, weekKeys, "followers");
  const instagramSeries = deltaSeries(instagramEntries, weekKeys, "followers");
  const xSeries = deltaSeries(xEntries, weekKeys, "followers");
  const ofSubscriberSeries = deltaSeries(ofEntries, weekKeys, "subscribers");

  const ofSummary = onlyFansSummary(ofEntries, weekKeys);
  const roiByWeek = new Map<string, number | null>(
    ofSummary.weeks.map((w) => [w.weekKey, w.roi]),
  );

  return ordered.map((wk, i) => ({
    weekKey: wk,
    label: weekLabelFn(wk),
    reddit: redditSeries[i]?.cumulative ?? null,
    instagram: instagramSeries[i]?.cumulative ?? null,
    x: xSeries[i]?.cumulative ?? null,
    onlyfans: ofSubscriberSeries[i]?.cumulative ?? null,
    roi: roiByWeek.get(wk) ?? null,
  }));
}

/* -------------------------------------------------------------------------- */
/*  Cross-platform aggregate (dashboard "All Models" overview)                */
/* -------------------------------------------------------------------------- */

export interface InfluencerEntries {
  influencerId: string;
  /** All entries for this influencer in the selected window, any platform. */
  entries: WeeklyEntry[];
}

export interface CrossPlatformAggregate {
  influencerCount: number;
  /** Total OnlyFans revenue across all influencers + all weeks (USD). */
  totalRevenue: number;
  /** Total OnlyFans spend across all influencers + all weeks (USD). */
  totalSpend: number;
  /** Total new subscribers gained across all influencers in the window. */
  totalSubs: number;
  net: number;
  roas: number | null;
  /** (revenue - spend) / spend * 100; null when spend is 0. */
  roi: number | null;
  /** Sum of latest cumulative followers across all influencers, per platform. */
  totalFollowers: Record<AcquisitionPlatformKey, number>;
  /** Total weekly follower growth (sum of deltas across all influencers). */
  weeklyFollowerGrowth: Record<AcquisitionPlatformKey, number>;
}

/**
 * Roll up a slice of entries (potentially many influencers, all platforms,
 * the selected weekKeys) into a single dashboard-ready summary.
 *
 * For follower totals we take each influencer's most-recent cumulative
 * reading inside the window and sum across influencers — that mirrors
 * what the operator would manually compute.
 */
export function crossPlatformAggregate(
  perInfluencer: InfluencerEntries[],
  weekKeys: readonly string[],
): CrossPlatformAggregate {
  let totalRevenue = 0;
  let totalSpend = 0;
  let totalSubs = 0;
  const totalFollowers: Record<AcquisitionPlatformKey, number> = {
    reddit: 0,
    instagram: 0,
    x: 0,
  };
  const weeklyFollowerGrowth: Record<AcquisitionPlatformKey, number> = {
    reddit: 0,
    instagram: 0,
    x: 0,
  };

  for (const ie of perInfluencer) {
    const ofEntries = ie.entries.filter((e) => e.platform === "onlyfans");
    const summary = onlyFansSummary(ofEntries, weekKeys);
    totalRevenue += summary.totals.revenue;
    totalSpend += summary.totals.spend;
    totalSubs += summary.totals.subs;

    for (const src of ACQUISITION_PLATFORM_KEYS) {
      const platformEntries = ie.entries.filter((e) => e.platform === src);
      const series = deltaSeries(platformEntries, weekKeys, "followers");
      const lastCum = [...series].reverse().find((p) => p.cumulative !== null);
      if (lastCum?.cumulative != null) totalFollowers[src] += lastCum.cumulative;
      weeklyFollowerGrowth[src] += series.reduce(
        (sum, p) => sum + (p.delta ?? 0),
        0,
      );
    }
  }

  return {
    influencerCount: perInfluencer.length,
    totalRevenue,
    totalSpend,
    totalSubs,
    net: totalRevenue - totalSpend,
    roas: totalSpend > 0 ? totalRevenue / totalSpend : null,
    roi: totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : null,
    totalFollowers,
    weeklyFollowerGrowth,
  };
}

/* -------------------------------------------------------------------------- */
/*  Misc convenience                                                          */
/* -------------------------------------------------------------------------- */

/** Find the most recent prior entry for a cumulative field, useful as a
 *  prefill hint in the entry form ("Last entry: 12,340"). */
export function priorCumulativeValue(
  entries: WeeklyEntry[],
  beforeWeekKey: string,
  fieldKey: string,
): { weekKey: string; value: number } | null {
  const candidates = entries
    .filter((e) => e.weekKey < beforeWeekKey && typeof e.data?.[fieldKey] === "number")
    .sort((a, b) => (a.weekKey < b.weekKey ? 1 : -1));
  if (candidates.length === 0) return null;
  const top = candidates[0];
  return { weekKey: top.weekKey, value: top.data[fieldKey] };
}
