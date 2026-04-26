"use client";

/**
 * Agency-wide ("All Models") dashboard view. Fans out per-creator transaction
 * fetches in parallel and aggregates them into KPIs, time series, channel mix,
 * and a creator leaderboard.
 */

import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  DollarSign,
  Receipt,
  Trophy,
  UserCheck,
  Users,
} from "lucide-react";
import { useAllCreatorTransactions } from "@/lib/infloww/hooks";
import {
  activeSubscribers as deriveActiveSubscribers,
  creatorLeaderboard,
  dailyRevenue,
  newSubscribers as deriveNewSubscribers,
  revenueByChannel,
  subscriberFlow,
  totalRevenue,
} from "@/lib/infloww/derive";
import { formatNumber, formatUSD } from "@/lib/infloww/util";
import type { InflowwCreator } from "@/lib/infloww/types";
import { KpiCard } from "./KpiCard";
import { ChartCard } from "./ChartCard";
import { RevenueChart } from "./charts/RevenueChart";
import { SubscriberChart } from "./charts/SubscriberChart";
import { RevenueBreakdown } from "./charts/RevenueBreakdown";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  creators: InflowwCreator[];
  startTime: string | number;
  endTime: string | number;
  rangeStart: Date;
  rangeEnd: Date;
  rangeLabel: string;
  onSelectCreator: (id: string) => void;
}

export function AggregateView({
  creators,
  startTime,
  endTime,
  rangeStart,
  rangeEnd,
  rangeLabel,
  onSelectCreator,
}: Props) {
  const creatorIds = useMemo(() => creators.map((c) => c.id), [creators]);
  const creatorById = useMemo(() => {
    const map = new Map<string, InflowwCreator>();
    for (const c of creators) map.set(c.id, c);
    return map;
  }, [creators]);

  const agg = useAllCreatorTransactions({
    creatorIds,
    startTime,
    endTime,
  });

  // Derive everything in one memo so we don't re-walk the array per chart.
  const derived = useMemo(() => {
    const totals = totalRevenue(agg.transactions);
    const channels = revenueByChannel(agg.transactions);
    const daily = dailyRevenue(agg.transactions, {
      start: rangeStart,
      end: rangeEnd,
    });
    const flow = subscriberFlow(agg.transactions, {
      start: rangeStart,
      end: rangeEnd,
    });
    const activeSubs = deriveActiveSubscribers(agg.transactions);
    const newSubs = deriveNewSubscribers(agg.transactions);
    const leaderboard = creatorLeaderboard(agg.byCreator);
    return { totals, channels, daily, flow, activeSubs, newSubs, leaderboard };
  }, [agg.transactions, agg.byCreator, rangeStart, rangeEnd]);

  const showInitialLoading = agg.totalCount > 0 && !agg.isSettled && agg.transactions.length === 0;

  return (
    <>
      <ProgressBanner agg={agg} />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCardOrSkeleton
          loading={showInitialLoading}
          label="Net Revenue"
          value={formatUSD(derived.totals.net)}
          icon={DollarSign}
          accent="success"
          hint={`Gross ${formatUSD(derived.totals.gross)} · ${rangeLabel.toLowerCase()}`}
        />
        <KpiCardOrSkeleton
          loading={showInitialLoading}
          label="Active Subscribers"
          value={formatNumber(derived.activeSubs)}
          icon={UserCheck}
          accent="info"
          hint={`Across ${formatNumber(creatorIds.length)} creators`}
        />
        <KpiCardOrSkeleton
          loading={showInitialLoading}
          label="New Subscribers"
          value={formatNumber(derived.newSubs)}
          icon={Users}
          accent="primary"
          hint={`In ${rangeLabel.toLowerCase()}`}
        />
        <KpiCardOrSkeleton
          loading={showInitialLoading}
          label="OnlyFans Fees"
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

      {/* Charts */}
      <section className="mb-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <ChartCard
            title="Daily Revenue"
            subtitle="Net revenue per day, agency-wide"
            className="xl:col-span-2"
          >
            {showInitialLoading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : derived.totals.count === 0 ? (
              <EmptyChart message="No transactions in this range." />
            ) : (
              <RevenueChart data={derived.daily} />
            )}
          </ChartCard>
          <ChartCard title="Subscription Activity" subtitle="New + recurring per day">
            {showInitialLoading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : derived.flow.length === 0 ? (
              <EmptyChart message="No subscription activity in this range." />
            ) : (
              <SubscriberChart data={derived.flow} />
            )}
          </ChartCard>
        </div>
      </section>

      {/* Channel breakdown */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
          Channel Mix
        </h2>
        <ChartCard
          title="Revenue by Channel"
          subtitle="Net revenue split across subs, tips, messages, and other"
        >
          {showInitialLoading ? (
            <Skeleton className="h-[260px] w-full" />
          ) : (
            <RevenueBreakdown channels={derived.channels} />
          )}
        </ChartCard>
      </section>

      {/* Creator leaderboard */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
          <Trophy className="size-4" />
          Creator Leaderboard
        </h2>
        <ChartCard
          title={`Top performers · ${rangeLabel}`}
          subtitle="Click any row to drill into that creator"
        >
          {showInitialLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-md" />
              ))}
            </div>
          ) : derived.leaderboard.length === 0 ? (
            <EmptyChart message="No revenue from any creator in this range." />
          ) : (
            <Leaderboard
              rows={derived.leaderboard}
              creatorById={creatorById}
              onSelect={onSelectCreator}
            />
          )}
        </ChartCard>
      </section>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

function ProgressBanner({
  agg,
}: {
  agg: ReturnType<typeof useAllCreatorTransactions>;
}) {
  if (agg.totalCount === 0) return null;
  const settled = agg.totalCount - agg.loadingCount;
  if (agg.isSettled && agg.errorCount === 0) return null;

  return (
    <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-secondary/40 border border-border text-xs">
      {agg.isLoading ? (
        <>
          <div className="size-3 rounded-full bg-primary animate-pulse mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="font-medium text-foreground">
              Loading {settled}/{agg.totalCount} creators…
            </div>
            <div className="text-muted-foreground mt-0.5">
              Aggregating transactions across the agency. KPIs update as creators load.
            </div>
          </div>
        </>
      ) : agg.errorCount > 0 ? (
        <>
          <AlertTriangle className="size-4 mt-0.5 shrink-0 text-warning" />
          <div className="flex-1">
            <div className="font-medium text-foreground">
              {agg.errorCount} of {agg.totalCount} creators failed to load
            </div>
            <div className="text-muted-foreground mt-0.5">
              Numbers below reflect only the {agg.totalCount - agg.errorCount} creators that responded.
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Leaderboard({
  rows,
  creatorById,
  onSelect,
}: {
  rows: ReturnType<typeof creatorLeaderboard>;
  creatorById: Map<string, InflowwCreator>;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="text-left py-2 px-2 font-medium">#</th>
            <th className="text-left py-2 px-2 font-medium">Creator</th>
            <th className="text-right py-2 px-2 font-medium">
              <span className="inline-flex items-center gap-1">
                Net <ArrowUpDown className="size-3 opacity-50" />
              </span>
            </th>
            <th className="text-right py-2 px-2 font-medium hidden sm:table-cell">Gross</th>
            <th className="text-right py-2 px-2 font-medium">Active</th>
            <th className="text-right py-2 px-2 font-medium hidden md:table-cell">New</th>
            <th className="text-left py-2 px-2 font-medium hidden lg:table-cell">Top channel</th>
            <th className="text-right py-2 px-2 font-medium hidden sm:table-cell">Share</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, i) => {
            const creator = creatorById.get(row.creatorId);
            const display =
              creator?.nickName || creator?.name || creator?.userName || row.creatorId;
            const initial = (display[0] ?? "?").toUpperCase();

            return (
              <tr
                key={row.creatorId}
                onClick={() => onSelect(row.creatorId)}
                className="hover:bg-secondary/40 cursor-pointer"
              >
                <td className="py-2 px-2 text-muted-foreground tabular-nums w-8">{i + 1}</td>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="size-7 rounded-full bg-gradient-primary grid place-items-center shrink-0 ring-1 ring-border">
                      <span className="text-primary-foreground text-[11px] font-semibold">
                        {initial}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-foreground truncate">{display}</div>
                      {creator?.userName && (
                        <div className="text-[10px] text-muted-foreground truncate">
                          @{creator.userName}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-2 px-2 text-right tabular-nums font-semibold text-success">
                  {formatUSD(row.net)}
                </td>
                <td className="py-2 px-2 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                  {formatUSD(row.gross)}
                </td>
                <td className="py-2 px-2 text-right tabular-nums">
                  {formatNumber(row.activeSubs)}
                </td>
                <td className="py-2 px-2 text-right tabular-nums text-muted-foreground hidden md:table-cell">
                  {formatNumber(row.newSubs)}
                </td>
                <td className="py-2 px-2 text-muted-foreground hidden lg:table-cell">
                  {row.topChannel ?? "—"}
                </td>
                <td className="py-2 px-2 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                  {(row.share * 100).toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

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
