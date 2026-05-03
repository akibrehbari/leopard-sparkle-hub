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
  /** Sum of per-source revenue. */
  totalRevenue: number;
  /** Sum of per-source spend. */
  totalSpend: number;
  net: number;
  /** revenue / spend; null when spend is 0 (avoid divide-by-zero). */
  roas: number | null;
}

export interface OnlyFansSourceSummary {
  source: AcquisitionPlatformKey;
  revenue: number;
  spend: number;
  net: number;
  roas: number | null;
  /** Per-week revenue series (USD) for sparkline rendering. */
  weekly: { weekKey: string; revenue: number; spend: number }[];
}

export interface OnlyFansSummary {
  weeks: OnlyFansWeekPoint[];
  /** Range-wide totals across every week + every source. */
  totals: {
    revenue: number;
    spend: number;
    net: number;
    roas: number | null;
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

  const sourceTotals: Record<AcquisitionPlatformKey, { revenue: number; spend: number }> = {
    reddit: { revenue: 0, spend: 0 },
    instagram: { revenue: 0, spend: 0 },
    x: { revenue: 0, spend: 0 },
  };

  const sourceWeekly: Record<AcquisitionPlatformKey, { weekKey: string; revenue: number; spend: number }[]> = {
    reddit: [],
    instagram: [],
    x: [],
  };

  const weeks: OnlyFansWeekPoint[] = ordered.map((wk) => {
    const entry = byWeek.get(wk);
    const data = entry?.data ?? {};

    const revenue: Record<AcquisitionPlatformKey, number> = {
      reddit: 0,
      instagram: 0,
      x: 0,
    };
    const spend: Record<AcquisitionPlatformKey, number> = {
      reddit: 0,
      instagram: 0,
      x: 0,
    };

    for (const src of ACQUISITION_PLATFORM_KEYS) {
      const r = data[onlyFansFieldKey("revenue", src)];
      const s = data[onlyFansFieldKey("spend", src)];
      revenue[src] = typeof r === "number" ? centsToUsd(r) : 0;
      spend[src] = typeof s === "number" ? centsToUsd(s) : 0;
      sourceTotals[src].revenue += revenue[src];
      sourceTotals[src].spend += spend[src];
      sourceWeekly[src].push({
        weekKey: wk,
        revenue: revenue[src],
        spend: spend[src],
      });
    }

    const totalRevenue =
      revenue.reddit + revenue.instagram + revenue.x;
    const totalSpend = spend.reddit + spend.instagram + spend.x;
    const net = totalRevenue - totalSpend;
    const roas = totalSpend > 0 ? totalRevenue / totalSpend : null;

    return {
      weekKey: wk,
      revenue,
      spend,
      totalRevenue,
      totalSpend,
      net,
      roas,
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

  return {
    weeks,
    totals: {
      revenue: totalRevenue,
      spend: totalSpend,
      net: totalRevenue - totalSpend,
      roas: totalSpend > 0 ? totalRevenue / totalSpend : null,
    },
    bySource: ACQUISITION_PLATFORM_KEYS.map((src) => {
      const r = sourceTotals[src].revenue;
      const s = sourceTotals[src].spend;
      return {
        source: src,
        revenue: r,
        spend: s,
        net: r - s,
        roas: s > 0 ? r / s : null,
        weekly: sourceWeekly[src],
      };
    }),
  };
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
  net: number;
  roas: number | null;
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
    net: totalRevenue - totalSpend,
    roas: totalSpend > 0 ? totalRevenue / totalSpend : null,
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
