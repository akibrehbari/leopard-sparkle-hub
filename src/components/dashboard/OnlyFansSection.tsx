import type { ModelProfile } from "@/data/types";
import { ChartCard } from "./ChartCard";
import { RevenueBreakdown } from "./charts/RevenueBreakdown";
import { SubsFlowChart } from "./charts/SubsFlowChart";
import { formatCurrency, formatNumber } from "@/data/selectors";
import { sliceHistory, type DateRange } from "@/data/selectors";

interface Props {
  model: ModelProfile;
  range: DateRange;
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg bg-secondary/40 border border-border p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold tabular-nums mt-1 ${accent ?? "text-foreground"}`}>{value}</div>
    </div>
  );
}

export function OnlyFansSection({ model, range }: Props) {
  const of = model.onlyFans;
  const data = sliceHistory(model.history, range);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <ChartCard
        title="Revenue Breakdown"
        subtitle="Subscriptions · Tips · PPV"
        className="xl:col-span-1"
      >
        <RevenueBreakdown
          subscription={of.subscriptionRevenue}
          tips={of.tipsRevenue}
          ppv={of.ppvRevenue}
        />
        <div className="grid grid-cols-2 gap-2 mt-5">
          <MiniStat label="Conversion" value={`${(of.conversionRate * 100).toFixed(1)}%`} accent="text-success" />
          <MiniStat label="Churn" value={`${(of.churnRate * 100).toFixed(1)}%`} accent="text-destructive" />
          <MiniStat label="Engagement" value={`${(of.engagementRate * 100).toFixed(1)}%`} accent="text-info" />
          <MiniStat label="Traffic clicks" value={formatNumber(of.trafficClicks)} />
        </div>
      </ChartCard>

      <ChartCard
        title="Subscriber Flow"
        subtitle="New vs lost subscribers per day"
        className="xl:col-span-2"
      >
        <div className="grid grid-cols-3 gap-2 mb-4">
          <MiniStat label="Active subs" value={formatNumber(of.activeSubscribers)} />
          <MiniStat label="New" value={`+${formatNumber(of.newSubscribers)}`} accent="text-success" />
          <MiniStat label="Lost" value={`-${formatNumber(of.lostSubscribers)}`} accent="text-destructive" />
        </div>
        <SubsFlowChart data={data} />
        <div className="mt-3 text-[11px] text-muted-foreground">
          Net change: {of.newSubscribers - of.lostSubscribers >= 0 ? "+" : ""}
          {formatNumber(of.newSubscribers - of.lostSubscribers)} subscribers · Net revenue {formatCurrency(of.totalRevenue)} this period
        </div>
      </ChartCard>
    </div>
  );
}