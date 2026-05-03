"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Topbar } from "@/components/dashboard/Topbar";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { ModelOverview } from "@/components/dashboard/ModelOverview";
import { OnlyFansSection } from "@/components/dashboard/OnlyFansSection";
import { RefundsSection } from "@/components/dashboard/RefundsSection";
import { LinksSection } from "@/components/dashboard/LinksSection";
import { PlatformSection } from "@/components/dashboard/PlatformSection";
import { RevenueChart } from "@/components/dashboard/charts/RevenueChart";
import { SubscriberChart } from "@/components/dashboard/charts/SubscriberChart";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

import { useTransactions } from "@/lib/infloww/infloww.hooks";
import { useInfluencers } from "@/lib/influencers/influencers.hooks";
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
  PlugZap,
} from "lucide-react";

const Index = () => {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <DashboardContent />
      </Suspense>
    </AppShell>
  );
};

function DashboardContent() {
  const router = useRouter();
  const search = useSearchParams();
  const selectedId = search.get("id") ?? "all";

  const setSelectedId = (id: string) => {
    const params = new URLSearchParams(search.toString());
    if (id === "all") params.delete("id");
    else params.set("id", id);
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/", { scroll: false });
  };

  const [range, setRange] = useState<DashboardRange>("30d");
  const { toast } = useToast();

  const influencersQ = useInfluencers();
  const influencers = influencersQ.data ?? [];

  const isAggregate = selectedId === "all";
  const selectedInfluencer = isAggregate
    ? null
    : influencers.find((i) => i._id === selectedId) ?? null;
  const inflowwCreatorId = selectedInfluencer?.inflowwCreatorId ?? null;
  const hasInfloww = Boolean(inflowwCreatorId);

  // Resolve range -> absolute window once per render. Memoized so the same
  // Date instances feed into both the API query (stable cache key) and the
  // derive helpers (gap-filling).
  const rangeWindow = useMemo(() => {
    const dates = rangeToDates(range);
    const params = rangeToQueryParams(range);
    return { ...dates, ...params };
  }, [range]);

  const txQ = useTransactions({
    creatorId: hasInfloww ? inflowwCreatorId : null,
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

  useEffect(() => {
    if (influencersQ.isError) {
      toast({
        title: "Failed to load influencers",
        description: (influencersQ.error as Error)?.message,
        variant: "destructive",
      });
    }
  }, [influencersQ.isError, influencersQ.error, toast]);

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
    ? `${RANGE_LABELS[range]} · ${
        influencersQ.isLoading ? "loading…" : `${influencers.length} influencers in your roster`
      }`
    : selectedInfluencer
      ? `${RANGE_LABELS[range]} · ${
          selectedInfluencer.inflowwUserName
            ? `@${selectedInfluencer.inflowwUserName}`
            : "Manual influencer"
        }`
      : RANGE_LABELS[range];

  const title = isAggregate
    ? "All Models Overview"
    : selectedInfluencer?.name || "Loading…";

  return (
    <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 animate-fade-in">
      {/* Mobile influencer picker */}
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
        {influencers.map((inf) => (
          <button
            key={inf._id}
            onClick={() => setSelectedId(inf._id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border ${
              selectedId === inf._id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary/50 text-muted-foreground border-border"
            }`}
          >
            {inf.name}
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
          influencer={selectedInfluencer}
          isAggregate={isAggregate}
          totalCreators={influencers.length}
          isLoading={
            !isAggregate &&
            (influencersQ.isLoading ||
              (!selectedInfluencer && !influencersQ.isError))
          }
        />
      </div>

      {isAggregate ? (
        <AggregateNotice creatorCount={influencers.length} />
      ) : (
        <>
          {!hasInfloww && (
            <NoInflowwBanner
              influencerName={selectedInfluencer?.name ?? ""}
            />
          )}

          {hasInfloww && (
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
                  creatorId={inflowwCreatorId!}
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
                  creatorId={inflowwCreatorId!}
                  startTime={rangeWindow.startTime}
                  endTime={rangeWindow.endTime}
                />
              </section>
            </>
          )}

          {/* Other platforms (manual weekly entry) — shown for every influencer */}
          {selectedInfluencer && (
            <section className="mb-6">
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                Other Platforms
              </h2>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <PlatformSection
                  influencer={selectedInfluencer}
                  platform="reddit"
                />
                <PlatformSection
                  influencer={selectedInfluencer}
                  platform="instagram"
                />
              </div>
            </section>
          )}
        </>
      )}

      <footer className="text-center text-xs text-muted-foreground pt-4 pb-2">
        eLeopards Clients Dashboard · Data from Infloww · Internal use only
      </footer>
    </div>
  );
}

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
        Pick an influencer to see their data
      </h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        {creatorCount === 0
          ? "No influencers in your roster yet. Open the Influencers page and click Sync Infloww accounts, or add one manually."
          : `Select any of your ${creatorCount} influencer${
              creatorCount === 1 ? "" : "s"
            } from the sidebar to view their OnlyFans (Infloww) analytics and Reddit / Instagram tracking.`}
      </p>
    </div>
  );
}

function NoInflowwBanner({ influencerName }: { influencerName: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-5 mb-6 flex items-start gap-3">
      <div className="size-9 rounded-lg bg-secondary/60 grid place-items-center shrink-0">
        <PlugZap className="size-5 text-muted-foreground" />
      </div>
      <div className="text-sm">
        <div className="font-medium text-foreground mb-0.5">
          {influencerName ? `${influencerName} doesn’t have an Infloww account` : "No Infloww account linked"}
        </div>
        <p className="text-xs text-muted-foreground">
          Showing only the manual platform tracking sections below. To enable
          OnlyFans analytics (revenue, subscribers, refunds, links), this
          influencer needs to be connected in Infloww first, then run{" "}
          <a href="/influencers" className="text-primary hover:underline">
            Sync Infloww accounts
          </a>
          .
        </p>
      </div>
    </div>
  );
}

export default Index;
