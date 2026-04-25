import type { DailyPoint, ModelProfile } from "./types";

export type DateRange = "7d" | "30d" | "90d";

export const RANGE_DAYS: Record<DateRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export function modelTotalFollowers(m: ModelProfile): number {
  const ig = m.instagram.reduce((s, a) => s + a.followers, 0);
  return m.reddit.followers + m.twitter.followers + ig + m.telegram.followers;
}

export function sliceHistory(points: DailyPoint[], range: DateRange): DailyPoint[] {
  const days = RANGE_DAYS[range];
  return points.slice(-days);
}

export function growthPct(points: DailyPoint[], key: keyof DailyPoint): number {
  if (points.length < 2) return 0;
  const first = Number(points[0][key]) || 0;
  const last = Number(points[points.length - 1][key]) || 0;
  if (first === 0) return 0;
  return ((last - first) / first) * 100;
}

export function aggregateHistory(models: ModelProfile[]): DailyPoint[] {
  if (models.length === 0) return [];
  const len = models[0].history.length;
  const out: DailyPoint[] = [];
  for (let d = 0; d < len; d++) {
    const sum: DailyPoint = {
      date: models[0].history[d].date,
      totalFollowers: 0,
      reddit: 0,
      twitter: 0,
      instagram: 0,
      telegram: 0,
      revenue: 0,
      subscribers: 0,
      newSubs: 0,
      lostSubs: 0,
    };
    for (const m of models) {
      const p = m.history[d];
      if (!p) continue;
      sum.totalFollowers += p.totalFollowers;
      sum.reddit += p.reddit;
      sum.twitter += p.twitter;
      sum.instagram += p.instagram;
      sum.telegram += p.telegram;
      sum.revenue += p.revenue;
      sum.subscribers += p.subscribers;
      sum.newSubs += p.newSubs;
      sum.lostSubs += p.lostSubs;
    }
    out.push(sum);
  }
  return out;
}

export function aggregateModel(models: ModelProfile[]): ModelProfile {
  const ig: ModelProfile["instagram"] = models.flatMap((m) =>
    m.instagram.map((a) => ({ handle: `${m.stageName}: ${a.handle}`, followers: a.followers }))
  );
  const sumOF = models.reduce(
    (acc, m) => {
      acc.totalRevenue += m.onlyFans.totalRevenue;
      acc.subscriptionRevenue += m.onlyFans.subscriptionRevenue;
      acc.tipsRevenue += m.onlyFans.tipsRevenue;
      acc.ppvRevenue += m.onlyFans.ppvRevenue;
      acc.activeSubscribers += m.onlyFans.activeSubscribers;
      acc.newSubscribers += m.onlyFans.newSubscribers;
      acc.lostSubscribers += m.onlyFans.lostSubscribers;
      acc.trafficClicks += m.onlyFans.trafficClicks;
      return acc;
    },
    {
      totalRevenue: 0,
      subscriptionRevenue: 0,
      tipsRevenue: 0,
      ppvRevenue: 0,
      activeSubscribers: 0,
      newSubscribers: 0,
      lostSubscribers: 0,
      trafficClicks: 0,
    }
  );
  const avg = (k: "conversionRate" | "churnRate" | "engagementRate") =>
    models.reduce((s, m) => s + m.onlyFans[k], 0) / Math.max(models.length, 1);

  return {
    id: "all",
    stageName: "All Models",
    actualName: `${models.length} operations`,
    profileImage: "",
    status: "Active",
    reddit: {
      handle: "—",
      subreddit: "—",
      karma: models.reduce((s, m) => s + m.reddit.karma, 0),
      followers: models.reduce((s, m) => s + m.reddit.followers, 0),
      subredditFollowers: models.reduce((s, m) => s + m.reddit.subredditFollowers, 0),
    },
    twitter: { handle: "—", followers: models.reduce((s, m) => s + m.twitter.followers, 0) },
    instagram: ig,
    telegram: { channel: "—", followers: models.reduce((s, m) => s + m.telegram.followers, 0) },
    onlyFans: {
      ...sumOF,
      conversionRate: avg("conversionRate"),
      churnRate: avg("churnRate"),
      engagementRate: avg("engagementRate"),
    },
    notes: {
      weeklyReport: "Aggregated view across all model operations. Switch to a specific model in the sidebar for individual reports.",
      upcomingPlan: "Aggregated view — see individual models for plans.",
    },
    history: aggregateHistory(models),
  };
}

export function formatNumber(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return n.toLocaleString();
}

export function formatCurrency(n: number): string {
  if (Math.abs(n) >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (Math.abs(n) >= 1_000) return "$" + (n / 1_000).toFixed(1) + "k";
  return "$" + n.toLocaleString();
}

export function formatPct(n: number, digits = 1): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}