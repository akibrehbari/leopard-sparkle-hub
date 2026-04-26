"use client";

import { ChartCard } from "./ChartCard";
import { RevenueBreakdown } from "./charts/RevenueBreakdown";
import { SubsFlowChart } from "./charts/SubsFlowChart";
import type {
  ChannelBreakdownPoint,
  RevenueTotals,
  SubscriberFlowPoint,
} from "@/lib/infloww/derive";
import { formatUSD, formatNumber } from "@/lib/infloww/util";

interface Props {
  channels: ChannelBreakdownPoint[];
  flow: SubscriberFlowPoint[];
  totals: RevenueTotals;
  activeSubs: number;
  newSubs: number;
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg bg-secondary/40 border border-border p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`text-lg font-bold tabular-nums mt-1 ${accent ?? "text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}

export function OnlyFansSection({
  channels,
  flow,
  totals,
  activeSubs,
  newSubs,
}: Props) {
  const renewalCount = flow.reduce((s, p) => s + p.renewals, 0);
  const feeShare = totals.gross > 0 ? (totals.fee / totals.gross) * 100 : 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <ChartCard
        title="Revenue Breakdown"
        subtitle="Subscriptions · Tips · Messages · Posts · Streams"
        className="xl:col-span-1"
      >
        <RevenueBreakdown channels={channels} />
        <div className="grid grid-cols-2 gap-2 mt-5">
          <MiniStat
            label="Gross"
            value={formatUSD(totals.gross)}
            accent="text-foreground"
          />
          <MiniStat
            label="Net"
            value={formatUSD(totals.net)}
            accent="text-success"
          />
          <MiniStat
            label="OF Fees"
            value={formatUSD(totals.fee)}
            accent="text-destructive"
          />
          <MiniStat
            label="Fee share"
            value={`${feeShare.toFixed(1)}%`}
            accent="text-muted-foreground"
          />
        </div>
      </ChartCard>

      <ChartCard
        title="Subscription Flow"
        subtitle="Daily new vs. recurring subscription transactions"
        className="xl:col-span-2"
      >
        <div className="grid grid-cols-3 gap-2 mb-4">
          <MiniStat
            label="Active subs"
            value={formatNumber(activeSubs)}
          />
          <MiniStat
            label="New"
            value={`+${formatNumber(newSubs)}`}
            accent="text-success"
          />
          <MiniStat
            label="Renewals"
            value={`${formatNumber(renewalCount)}`}
            accent="text-info"
          />
        </div>
        <SubsFlowChart data={flow} />
        <div className="mt-3 text-[11px] text-muted-foreground">
          Activity from {totals.count} settled transactions in this range. Net
          revenue: {formatUSD(totals.net, { fractional: true })}.
        </div>
      </ChartCard>
    </div>
  );
}
