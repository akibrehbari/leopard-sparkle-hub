"use client";

/**
 * Read-only renderer for /share/[id].
 *
 * Re-uses the same dashboard widgets the authenticated app uses, fed entirely
 * by the SharePayload prop (no React Query, no auth). Adds:
 *   - A minimal top bar with the range pills (purely client-side, navigates
 *     by changing the ?range=… query param).
 *   - An "Export as PDF" button that calls window.print(); print CSS is
 *     shared with the authenticated app via globals.
 *   - A footer noting the read-only / generated-at info.
 *
 * No sidebar — this view is built for external recipients with the URL.
 */

import { useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { LinksSection } from "@/components/dashboard/LinksSection";
import { ModelOverview } from "@/components/dashboard/ModelOverview";
import { OnlyFansSection } from "@/components/dashboard/OnlyFansSection";
import { PlatformSection } from "@/components/dashboard/PlatformSection";
import { RefundsSection } from "@/components/dashboard/RefundsSection";
import { RevenueChart } from "@/components/dashboard/charts/RevenueChart";
import { SubscriberChart } from "@/components/dashboard/charts/SubscriberChart";
import { cn } from "@/lib/utils";
import { formatNumber, formatUSD } from "@/lib/infloww/util";
import {
  activeSubscribers as deriveActiveSubscribers,
  dailyRevenue,
  newSubscribers as deriveNewSubscribers,
  revenueByChannel,
  subscriberFlow,
  totalRevenue,
} from "@/lib/utils/derive";
import {
  DASHBOARD_RANGES,
  RANGE_LABELS,
  type DashboardRange,
} from "@/lib/utils/range";
import type { SharePayload } from "@/lib/share/types";
import {
  DollarSign,
  PlugZap,
  Receipt,
  UserCheck,
  Users,
} from "lucide-react";

interface Props {
  payload: SharePayload;
}

export function ShareDashboard({ payload }: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const range = payload.range;
  const { influencer, infloww, entries, platforms, window } = payload;
  const hasInfloww = Boolean(influencer.inflowwCreatorId);

  const setRange = (next: DashboardRange) => {
    const params = new URLSearchParams(search.toString());
    params.set("range", next);
    router.push(`/share/${influencer._id}?${params.toString()}`, {
      scroll: false,
    });
  };

  /* -- Re-derive Infloww aggregates from prefetched transactions -------- */
  const derived = useMemo(() => {
    const transactions = infloww?.transactions ?? [];
    const start = new Date(window.startISO);
    const end = new Date(window.endISO);
    return {
      totals: totalRevenue(transactions),
      channels: revenueByChannel(transactions),
      daily: dailyRevenue(transactions, { start, end }),
      flow: subscriberFlow(transactions, { start, end }),
      activeSubs: deriveActiveSubscribers(transactions),
      newSubs: deriveNewSubscribers(transactions),
    };
  }, [infloww, window.startISO, window.endISO]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ShareTopbar
        title={influencer.name}
        subtitle={
          influencer.inflowwUserName
            ? `@${influencer.inflowwUserName} · Read-only share`
            : "Manual influencer · Read-only share"
        }
        range={range}
        onRangeChange={setRange}
      />

      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 animate-fade-in">
        <div className="mb-6">
          <ModelOverview influencer={influencer} />
        </div>

        {!hasInfloww && (
          <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-5 mb-6 flex items-start gap-3">
            <div className="size-9 rounded-lg bg-secondary/60 grid place-items-center shrink-0">
              <PlugZap className="size-5 text-muted-foreground" />
            </div>
            <div className="text-sm">
              <div className="font-medium text-foreground mb-0.5">
                {influencer.name} doesn&rsquo;t have an Infloww account linked
              </div>
              <p className="text-xs text-muted-foreground">
                Showing only the manual platform tracking sections below.
              </p>
            </div>
          </div>
        )}

        {hasInfloww && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <KpiCard
                label="Net Revenue"
                value={formatUSD(derived.totals.net)}
                icon={DollarSign}
                accent="success"
                hint={`Gross ${formatUSD(derived.totals.gross)}`}
              />
              <KpiCard
                label="Active Subscribers"
                value={formatNumber(derived.activeSubs)}
                icon={UserCheck}
                accent="info"
                hint={`${formatNumber(derived.totals.count)} transactions`}
              />
              <KpiCard
                label="New Subscribers"
                value={formatNumber(derived.newSubs)}
                icon={Users}
                accent="primary"
                hint={`In ${RANGE_LABELS[range].toLowerCase()}`}
              />
              <KpiCard
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

            <section className="mb-6">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <ChartCard
                  title="Daily Revenue"
                  subtitle="Net revenue per day across all channels"
                  className="xl:col-span-2"
                >
                  {derived.totals.count === 0 ? (
                    <EmptyChart message="No transactions in this range." />
                  ) : (
                    <RevenueChart data={derived.daily} />
                  )}
                </ChartCard>
                <ChartCard
                  title="Subscription Activity"
                  subtitle="New + recurring per day"
                >
                  {derived.flow.length === 0 ? (
                    <EmptyChart message="No subscription activity in this range." />
                  ) : (
                    <SubscriberChart data={derived.flow} />
                  )}
                </ChartCard>
              </div>
            </section>

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

            <section className="mb-6">
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                Refunds
              </h2>
              <RefundsSection
                creatorId={influencer.inflowwCreatorId ?? null}
                startTime={window.startISO}
                endTime={window.endISO}
                prefetched={infloww?.refunds ?? []}
              />
            </section>

            <section className="mb-6">
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                Marketing Performance
              </h2>
              <LinksSection
                creatorId={influencer.inflowwCreatorId ?? null}
                startTime={window.startISO}
                endTime={window.endISO}
                prefetched={infloww?.links ?? {}}
              />
            </section>
          </>
        )}

        <section className="mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
            <span className="size-2 rounded-full bg-orange-500" />
            Reddit
          </h2>
          <PlatformSection
            influencer={influencer}
            platform="reddit"
            prefetchedEntries={entries.reddit ?? []}
            prefetchedPlatform={platforms.reddit}
            readOnly
          />
        </section>

        <section className="mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
            <span className="size-2 rounded-full bg-pink-500" />
            Instagram
          </h2>
          <PlatformSection
            influencer={influencer}
            platform="instagram"
            prefetchedEntries={entries.instagram ?? []}
            prefetchedPlatform={platforms.instagram}
            readOnly
          />
        </section>

        <ShareFooter generatedAt={payload.generatedAt} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Local sub-components                                                      */
/* -------------------------------------------------------------------------- */

function ShareTopbar({
  title,
  subtitle,
  range,
  onRangeChange,
}: {
  title: string;
  subtitle: string;
  range: DashboardRange;
  onRangeChange: (r: DashboardRange) => void;
}) {
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-xl bg-primary/15 text-primary grid place-items-center shrink-0 no-print">
            <ShieldCheck className="size-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-semibold truncate">{title}</h1>
            <p className="text-[11px] text-muted-foreground truncate">
              {subtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 no-print">
          <div className="flex items-center rounded-lg bg-secondary/50 border border-border p-1">
            {DASHBOARD_RANGES.map((r) => (
              <button
                key={r}
                onClick={() => onRangeChange(r)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  range === r
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => window.print()}
          >
            <Download className="size-4" />
            Export PDF
          </Button>
        </div>
      </div>
    </header>
  );
}

function ShareFooter({ generatedAt }: { generatedAt: string }) {
  const when = new Date(generatedAt);
  return (
    <footer className="text-center text-[11px] text-muted-foreground pt-6 pb-2 border-t border-border/60">
      <div>
        Read-only share &middot; Live data, refreshed on each visit
      </div>
      <div className="mt-1 no-print">
        Page generated {when.toLocaleString()} &middot;{" "}
        <Link href="/login" className="hover:underline">
          Team sign-in
        </Link>
      </div>
    </footer>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-[260px] flex items-center justify-center text-xs text-muted-foreground">
      {message}
    </div>
  );
}
