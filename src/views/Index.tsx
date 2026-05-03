"use client";

import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Topbar } from "@/components/dashboard/Topbar";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { ModelOverview } from "@/components/dashboard/ModelOverview";
import { OnlyFansSection } from "@/components/dashboard/OnlyFansSection";
import { RefundsSection } from "@/components/dashboard/RefundsSection";
import { LinksSection } from "@/components/dashboard/LinksSection";
import { RevenueChart } from "@/components/dashboard/charts/RevenueChart";
import { SubscriberChart } from "@/components/dashboard/charts/SubscriberChart";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

import { useCreators, useTransactions } from "@/lib/infloww/infloww.hooks";
import {
  activeSubscribers as deriveActiveSubscribers,
  dailyRevenue,
  newSubscribers as deriveNewSubscribers,
  revenueByChannel,
  subscriberFlow,
  totalRevenue,
} from "@/lib/utils/derive";
import {
  rangeToDates,
  rangeToQueryParams,
  RANGE_LABELS,
  type DashboardRange,
} from "@/lib/utils/range";
import { formatUSD, formatNumber } from "@/lib/infloww/util";
import {
  AlertTriangle,
  DollarSign,
  Receipt,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";

const Index = () => {
  const [selectedId, setSelectedId] = useState<string>("all");
  const [range, setRange] = useState<DashboardRange>("30d");
  const { toast } = useToast();

  const creatorsQ = useCreators({ limit: 100 });
  const creators = creatorsQ.data?.data?.list ?? [];

  const isAggregate = selectedId === "all";
  const selectedCreator = isAggregate
    ? null
    : creators.find((c) => c.id === selectedId) ?? null;

  // Resolve range -> absolute window once per render. Memoized so the same
  // Date instances feed into both the API query (stable cache key) and the
  // derive helpers (gap-filling).
  const rangeWindow = useMemo(() => {
    const dates = rangeToDates(range);
    const params = rangeToQueryParams(range);
    return { ...dates, ...params };
  }, [range]);

  const txQ = useTransactions({
    creatorId: isAggregate ? null : selectedId,
    startTime: rangeWindow.startTime,
    endTime: rangeWindow.endTime,
    all: true,
  });

  const transactions = txQ.data?.data?.list ?? [];

  // Derive everything in a single memo so we don't re-walk the array per chart.
  const derived = useMemo(() => {
    const totals = totalRevenue(transactions);
    const channels = revenueByChannel(transactions);
    const daily = dailyRevenue(transactions, {
      start: rangeWindow.start,
      end: rangeWindow.end,
    });
    const flow = subscriberFlow(transactions, {
      start: rangeWindow.start,
      end: rangeWindow.end,
    });
    const activeSubs = deriveActiveSubscribers(transactions);
    const newSubs = deriveNewSubscribers(transactions);
    return { totals, channels, daily, flow, activeSubs, newSubs };
  }, [transactions, rangeWindow.start, rangeWindow.end]);

  // Surface fetch errors as toasts (one-shot per change).
  useEffect(() => {
    if (creatorsQ.isError) {
      toast({
        title: "Failed to load creators",
        description: (creatorsQ.error as Error)?.message,
        variant: "destructive",
      });
    }
  }, [creatorsQ.isError, creatorsQ.error, toast]);

  useEffect(() => {
    if (txQ.isError) {
      toast({
        title: "Failed to load transactions",
        description: (txQ.error as Error)?.message,
        variant: "destructive",
      });
    }
  }, [txQ.isError, txQ.error, toast]);

  const subtitle = isAggregate
    ? `${RANGE_LABELS[range]} · aggregated view${
        creatorsQ.isLoading ? "" : ` across ${creators.length} creators`
      }`
    : selectedCreator
      ? `${RANGE_LABELS[range]} · @${selectedCreator.userName ?? selectedCreator.id}`
      : RANGE_LABELS[range];

  const title = isAggregate
    ? "All Models Overview"
    : selectedCreator?.nickName ||
      selectedCreator?.name ||
      selectedCreator?.userName ||
      "Loading…";

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar selectedId={selectedId} onSelect={setSelectedId} />

      <main className="flex-1 min-w-0">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 animate-fade-in">
          {/* Mobile creator picker */}
          <div className="lg:hidden mb-4 flex items-center gap-2 overflow-x-auto scrollbar-thin pb-2">
            <button
              onClick={() => setSelectedId("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border ${
                selectedId === "all"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary/50 text-muted-foreground border-border"
              }`}
            >
              All Models
            </button>
            {creators.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border ${
                  selectedId === c.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/50 text-muted-foreground border-border"
                }`}
              >
                {c.nickName || c.name || c.userName || c.id}
              </button>
            ))}
          </div>

          <Topbar
            title={title}
            subtitle={subtitle}
            range={range}
            onRangeChange={setRange}
          />

          <div className="mb-6">
            <ModelOverview
              creator={selectedCreator}
              isAggregate={isAggregate}
              totalCreators={creators.length}
              isLoading={
                !isAggregate && (creatorsQ.isLoading || (!selectedCreator && !creatorsQ.isError))
              }
            />
          </div>

          {isAggregate ? (
            <AggregateNotice creatorCount={creators.length} />
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <KpiCardOrSkeleton
                  loading={txQ.isLoading}
                  label="Net Revenue"
                  value={formatUSD(derived.totals.net)}
                  icon={DollarSign}
                  accent="success"
                  hint={`Gross ${formatUSD(derived.totals.gross)}`}
                />
                <KpiCardOrSkeleton
                  loading={txQ.isLoading}
                  label="Active Subscribers"
                  value={formatNumber(derived.activeSubs)}
                  icon={UserCheck}
                  accent="info"
                  hint={`${formatNumber(derived.totals.count)} transactions`}
                />
                <KpiCardOrSkeleton
                  loading={txQ.isLoading}
                  label="New Subscribers"
                  value={formatNumber(derived.newSubs)}
                  icon={Users}
                  accent="primary"
                  hint={`In ${RANGE_LABELS[range].toLowerCase()}`}
                />
                <KpiCardOrSkeleton
                  loading={txQ.isLoading}
                  label="OF Fees"
                  value={formatUSD(derived.totals.fee)}
                  icon={Receipt}
                  accent="instagram"
                  hint={
                    derived.totals.gross > 0
                      ? `${((derived.totals.fee / derived.totals.gross) * 100).toFixed(1)}% of gross`
                      : "—"
                  }
                />
              </div>

              {txQ.isError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive border border-destructive/30 text-sm mb-6">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">
                      Couldn’t load transactions for this creator.
                    </div>
                    <div className="text-destructive/80 mt-0.5 text-xs">
                      {(txQ.error as Error)?.message}
                    </div>
                  </div>
                </div>
              )}

              {/* Time-based graphs */}
              <section className="mb-6">
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  <ChartCard
                    title="Daily Revenue"
                    subtitle="Net revenue per day across all channels"
                    className="xl:col-span-2"
                  >
                    {txQ.isLoading ? (
                      <Skeleton className="h-[260px] w-full" />
                    ) : derived.totals.count === 0 ? (
                      <EmptyChart message="No transactions in this range." />
                    ) : (
                      <RevenueChart data={derived.daily} />
                    )}
                  </ChartCard>
                  <ChartCard
                    title="Subscription Activity"
                    subtitle="New + recurring per day"
                  >
                    {txQ.isLoading ? (
                      <Skeleton className="h-[260px] w-full" />
                    ) : derived.flow.length === 0 ? (
                      <EmptyChart message="No subscription activity in this range." />
                    ) : (
                      <SubscriberChart data={derived.flow} />
                    )}
                  </ChartCard>
                </div>
              </section>

              {/* Revenue + sub flow */}
              <section className="mb-6">
                <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                  Revenue Performance
                </h2>
                <OnlyFansSection
                  channels={derived.channels}
                  flow={derived.flow}
                  totals={derived.totals}
                  activeSubs={derived.activeSubs}
                  newSubs={derived.newSubs}
                />
              </section>

              {/* Refunds */}
              <section className="mb-6">
                <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                  Refunds
                </h2>
                <RefundsSection
                  creatorId={selectedId}
                  startTime={rangeWindow.startTime}
                  endTime={rangeWindow.endTime}
                />
              </section>

              {/* Marketing links */}
              <section className="mb-6">
                <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                  Marketing Performance
                </h2>
                <LinksSection
                  creatorId={selectedId}
                  startTime={rangeWindow.startTime}
                  endTime={rangeWindow.endTime}
                />
              </section>
            </>
          )}

          <footer className="text-center text-xs text-muted-foreground pt-4 pb-2">
            eLeopards Clients Dashboard · Data from Infloww · Internal use only
          </footer>
        </div>
      </main>
    </div>
  );
};

/* -------------------------------------------------------------------------- */

function KpiCardOrSkeleton(
  props: React.ComponentProps<typeof KpiCard> & { loading: boolean },
) {
  if (props.loading) {
    return (
      <div className="card-surface rounded-xl p-5 space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { loading, ...rest } = props;
  return <KpiCard {...rest} />;
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-[260px] flex items-center justify-center text-xs text-muted-foreground">
      {message}
    </div>
  );
}

function AggregateNotice({ creatorCount }: { creatorCount: number }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-8 text-center">
      <div className="mx-auto size-12 rounded-full bg-secondary/60 grid place-items-center mb-3">
        <TrendingUp className="size-5 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold mb-1">
        Pick a creator to see their data
      </h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        {creatorCount === 0
          ? "No creators are connected to your Infloww account yet."
          : `Select one of your ${creatorCount} connected creator${
              creatorCount === 1 ? "" : "s"
            } from the sidebar to view revenue, subscribers, refunds, and marketing performance.`}
      </p>
      <p className="text-xs text-muted-foreground/70 mt-3">
        Cross-creator aggregation is coming soon — the Infloww API is creator-scoped
        for analytics endpoints.
      </p>
    </div>
  );
}

export default Index;
