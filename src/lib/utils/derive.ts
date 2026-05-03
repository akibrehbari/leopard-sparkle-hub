/**
 * Pure functions that turn raw Infloww transaction / link data into the shapes
 * the dashboard needs (KPIs, time series, channel breakdowns).
 *
 * These are *pure*: no fetches, no side effects. Easy to unit test.
 */

import type {
  InflowwLink,
  InflowwRefund,
  InflowwTransaction,
  InflowwTransactionType,
} from "@/lib/infloww/types";
import { dayKey, inflowwAmount, parseInflowwTime, shortDateLabel } from "@/lib/infloww/util";

/* -------------------------------------------------------------------------- */
/*  Channel grouping                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Spec lists 7 transaction types. For dashboards we collapse the two
 * subscription variants into a single "Subscriptions" channel, since fans
 * don't care about the renewal-vs-new distinction in a revenue chart.
 */
export type RevenueChannel =
  | "Subscriptions"
  | "Tips"
  | "Messages"
  | "Posts"
  | "Streams"
  | "Referrals"
  | "Other";

/**
 * Map raw transaction types to dashboard channels. The spec lists
 * "Recurring Subscription" with a space, but the live API returns
 * "RecurringSubscription" without one — we accept both.
 */
const CHANNEL_BY_TYPE: Record<string, RevenueChannel> = {
  Subscription: "Subscriptions",
  RecurringSubscription: "Subscriptions",
  "Recurring Subscription": "Subscriptions",
  Tips: "Tips",
  Messages: "Messages",
  Posts: "Posts",
  Streams: "Streams",
  Referrals: "Referrals",
  Unknown: "Other",
};

export const REVENUE_CHANNELS: RevenueChannel[] = [
  "Subscriptions",
  "Tips",
  "Messages",
  "Posts",
  "Streams",
  "Referrals",
  "Other",
];

export function channelOf(t: InflowwTransaction): RevenueChannel {
  return CHANNEL_BY_TYPE[t.type] ?? "Other";
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Only count "settled" money. The spec lists statuses as:
 *   loading | done | undo | pending_return
 * "done" = settled, "undo" = reversed, "pending_return" = pending refund,
 * "loading" = still syncing. We treat "done" and "loading" as included
 * (loading rows still represent real money in the queue), and exclude
 * "undo" and "pending_return".
 */
function isCountable(t: InflowwTransaction): boolean {
  return t.status === "done" || t.status === "loading";
}

/* -------------------------------------------------------------------------- */
/*  Top-line KPIs                                                             */
/* -------------------------------------------------------------------------- */

export interface RevenueTotals {
  /** Sum of `amount` (gross, before OnlyFans fees), in USD. */
  gross: number;
  /** Sum of `fee`, in USD. */
  fee: number;
  /** Sum of `net` (what the creator actually receives), in USD. */
  net: number;
  /** Number of transactions counted. */
  count: number;
}

export function totalRevenue(transactions: InflowwTransaction[]): RevenueTotals {
  const totals: RevenueTotals = { gross: 0, fee: 0, net: 0, count: 0 };
  for (const t of transactions) {
    if (!isCountable(t)) continue;
    totals.gross += inflowwAmount(t.amount, "cents");
    totals.fee += inflowwAmount(t.fee, "cents");
    totals.net += inflowwAmount(t.net, "cents");
    totals.count += 1;
  }
  return totals;
}

/**
 * Active subscribers = unique fanIds with any subscription transaction
 * (new or renewal) in the window.
 */
export function activeSubscribers(transactions: InflowwTransaction[]): number {
  const fans = new Set<string>();
  for (const t of transactions) {
    if (!isCountable(t)) continue;
    if (isAnySubscription(t) && t.fanId) fans.add(t.fanId);
  }
  return fans.size;
}

/**
 * New subscribers = unique fanIds with a first-time "Subscription" event
 * (as opposed to "RecurringSubscription" / "Recurring Subscription" which
 * are renewals). Approximates new sign-ups in the window.
 */
export function newSubscribers(transactions: InflowwTransaction[]): number {
  const fans = new Set<string>();
  for (const t of transactions) {
    if (!isCountable(t)) continue;
    if (t.type === "Subscription" && t.fanId) {
      fans.add(t.fanId);
    }
  }
  return fans.size;
}

function isRenewal(t: InflowwTransaction): boolean {
  return (
    t.type === "RecurringSubscription" ||
    t.type === "Recurring Subscription"
  );
}

function isAnySubscription(t: InflowwTransaction): boolean {
  return t.type === "Subscription" || isRenewal(t);
}

/* -------------------------------------------------------------------------- */
/*  Time series                                                               */
/* -------------------------------------------------------------------------- */

export interface DailyRevenuePoint {
  /** "YYYY-MM-DD" — stable map key. */
  key: string;
  /** Display label for chart axis ("Mar 14"). */
  label: string;
  /** Date object at local midnight. */
  date: Date;
  gross: number;
  net: number;
  /** Per-channel net revenue for the day. */
  byChannel: Record<RevenueChannel, number>;
}

/**
 * Bucket transactions by local day. Returns a sorted list (oldest first).
 * If `range` is provided, fills missing days with zero so the chart x-axis
 * is continuous.
 */
export function dailyRevenue(
  transactions: InflowwTransaction[],
  range?: { start: Date; end: Date },
): DailyRevenuePoint[] {
  const map = new Map<string, DailyRevenuePoint>();

  const ensure = (d: Date): DailyRevenuePoint => {
    const key = dayKey(d);
    let point = map.get(key);
    if (!point) {
      point = {
        key,
        label: shortDateLabel(d),
        date: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
        gross: 0,
        net: 0,
        byChannel: emptyChannelTotals(),
      };
      map.set(key, point);
    }
    return point;
  };

  for (const t of transactions) {
    if (!isCountable(t)) continue;
    const d = parseInflowwTime(t.createdTime);
    if (!d) continue;
    const point = ensure(d);
    const gross = inflowwAmount(t.amount, "cents");
    const net = inflowwAmount(t.net, "cents");
    point.gross += gross;
    point.net += net;
    point.byChannel[channelOf(t)] += net;
  }

  if (range) {
    const cursor = new Date(range.start);
    cursor.setHours(0, 0, 0, 0);
    const stop = new Date(range.end);
    stop.setHours(0, 0, 0, 0);
    while (cursor <= stop) {
      ensure(cursor);
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
}

function emptyChannelTotals(): Record<RevenueChannel, number> {
  return {
    Subscriptions: 0,
    Tips: 0,
    Messages: 0,
    Posts: 0,
    Streams: 0,
    Referrals: 0,
    Other: 0,
  };
}

/* -------------------------------------------------------------------------- */
/*  Channel breakdown                                                         */
/* -------------------------------------------------------------------------- */

export interface ChannelBreakdownPoint {
  channel: RevenueChannel;
  net: number;
  gross: number;
  count: number;
  /** 0..1 share of total net. */
  share: number;
}

export function revenueByChannel(
  transactions: InflowwTransaction[],
): ChannelBreakdownPoint[] {
  const buckets: Record<
    RevenueChannel,
    { net: number; gross: number; count: number }
  > = {
    Subscriptions: { net: 0, gross: 0, count: 0 },
    Tips: { net: 0, gross: 0, count: 0 },
    Messages: { net: 0, gross: 0, count: 0 },
    Posts: { net: 0, gross: 0, count: 0 },
    Streams: { net: 0, gross: 0, count: 0 },
    Referrals: { net: 0, gross: 0, count: 0 },
    Other: { net: 0, gross: 0, count: 0 },
  };

  for (const t of transactions) {
    if (!isCountable(t)) continue;
    const ch = channelOf(t);
    buckets[ch].net += inflowwAmount(t.net, "cents");
    buckets[ch].gross += inflowwAmount(t.amount, "cents");
    buckets[ch].count += 1;
  }

  const totalNet = REVENUE_CHANNELS.reduce(
    (sum, ch) => sum + buckets[ch].net,
    0,
  );

  return REVENUE_CHANNELS.map((channel) => ({
    channel,
    net: buckets[channel].net,
    gross: buckets[channel].gross,
    count: buckets[channel].count,
    share: totalNet > 0 ? buckets[channel].net / totalNet : 0,
  })).filter((p) => p.count > 0 || p.net > 0);
}

/* -------------------------------------------------------------------------- */
/*  Subscriber growth                                                         */
/* -------------------------------------------------------------------------- */

export interface SubscriberFlowPoint {
  key: string;
  label: string;
  date: Date;
  /** New (first-time) subscriptions on this day. */
  newSubs: number;
  /** Recurring renewals on this day. */
  renewals: number;
}

/**
 * Daily flow of new vs. recurring subscriptions. Useful for the "subscriber
 * growth" chart even without true churn data.
 */
export function subscriberFlow(
  transactions: InflowwTransaction[],
  range?: { start: Date; end: Date },
): SubscriberFlowPoint[] {
  const map = new Map<string, SubscriberFlowPoint>();

  const ensure = (d: Date): SubscriberFlowPoint => {
    const key = dayKey(d);
    let point = map.get(key);
    if (!point) {
      point = {
        key,
        label: shortDateLabel(d),
        date: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
        newSubs: 0,
        renewals: 0,
      };
      map.set(key, point);
    }
    return point;
  };

  for (const t of transactions) {
    if (!isCountable(t)) continue;
    if (!isAnySubscription(t)) continue;
    const d = parseInflowwTime(t.createdTime);
    if (!d) continue;
    const point = ensure(d);
    if (t.type === "Subscription") point.newSubs += 1;
    else point.renewals += 1;
  }

  if (range) {
    const cursor = new Date(range.start);
    cursor.setHours(0, 0, 0, 0);
    const stop = new Date(range.end);
    stop.setHours(0, 0, 0, 0);
    while (cursor <= stop) {
      ensure(cursor);
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
}

/* -------------------------------------------------------------------------- */
/*  Refund summary                                                            */
/* -------------------------------------------------------------------------- */

export interface RefundSummary {
  count: number;
  /** USD. The refund endpoint returns paymentAmount as decimal dollars. */
  totalAmount: number;
  /** Refunds whose paymentStatus is "done". */
  completed: number;
}

export function summarizeRefunds(refunds: InflowwRefund[]): RefundSummary {
  let count = 0;
  let totalAmount = 0;
  let completed = 0;
  for (const r of refunds) {
    count += 1;
    // Live API returns paymentAmount as cents-string ("2999" = $29.99).
    totalAmount += inflowwAmount(r.paymentAmount, "cents");
    if (r.paymentStatus === "done") completed += 1;
  }
  return { count, totalAmount, completed };
}

/* -------------------------------------------------------------------------- */
/*  Link summaries                                                            */
/* -------------------------------------------------------------------------- */

export interface LinkSummary {
  totalLinks: number;
  totalSubs: number;
  totalEarningsNet: number;
  totalEarningsGross: number;
}

export function summarizeLinks(links: InflowwLink[]): LinkSummary {
  let totalSubs = 0;
  let totalEarningsNet = 0;
  let totalEarningsGross = 0;
  for (const link of links) {
    totalEarningsNet += inflowwAmount(link.earningsNet, "cents");
    totalEarningsGross += inflowwAmount(link.earningsGross, "cents");
    // subCount is "string | number" in live data; coerce safely.
    if ("subCount" in link && link.subCount !== undefined) {
      const n = Number(link.subCount);
      if (Number.isFinite(n)) totalSubs += n;
    }
  }
  return {
    totalLinks: links.length,
    totalSubs,
    totalEarningsNet,
    totalEarningsGross,
  };
}
