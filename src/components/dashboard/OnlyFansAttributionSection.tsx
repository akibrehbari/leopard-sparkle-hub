"use client";

/**
 * OnlyFans attribution section.
 *
 * Renders the only revenue-generating platform's dashboard. Pulls weekly
 * entries (per-week revenue + spend per acquisition source) and turns them
 * into:
 *   - 4 KPI tiles: total revenue, total spend, net, ROAS
 *   - 1 stacked bar chart per metric: revenue-by-source, spend-by-source
 *   - One mini summary card per acquisition source with sparkline
 *
 * Component contract:
 *   - Pure data-driven; no internal hooks. Takes an OnlyFansSummary plus the
 *     usual edit-form trigger callback so the share page (read-only) can
 *     pass `readOnly` and skip the modal entirely.
 */

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, DollarSign, Pencil, Plus, Receipt, Target, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { EntryFormModal } from "@/components/entries/EntryFormModal";
import {
  ACQUISITION_PLATFORM_KEYS,
  type AcquisitionPlatformKey,
  PLATFORMS,
} from "@/lib/platforms/registry";
import type { Influencer } from "@/lib/influencers/types";
import type { WeeklyEntry } from "@/lib/entries/types";
import type {
  OnlyFansSourceSummary,
  OnlyFansSummary,
} from "@/lib/utils/derive";
import { onlyFansSummary } from "@/lib/utils/derive";
import { useEntries } from "@/lib/entries/entries.hooks";
import { formatUSD } from "@/lib/utils/format";
import { currentWeekKey, lastNWeeks, weekShortLabel } from "@/lib/utils/week";

const HISTORY_WEEKS = 12;

interface Props {
  influencer: Influencer;
  /** Pre-fetched OnlyFans entries (used by the public /share page). */
  prefetchedEntries?: WeeklyEntry[];
  /** Read-only mode hides the "Log this week" button + per-week click hooks. */
  readOnly?: boolean;
}

const SOURCE_COLOR: Record<AcquisitionPlatformKey, string> = {
  reddit: "#FF4500",
  instagram: "#E4405F",
  x: "#FFFFFF",
};

const SOURCE_LABEL: Record<AcquisitionPlatformKey, string> = {
  reddit: "Reddit",
  instagram: "Instagram",
  x: "X",
};

export function OnlyFansAttributionSection({
  influencer,
  prefetchedEntries,
  readOnly,
}: Props) {
  const usePrefetched = prefetchedEntries !== undefined;
  const weekKeys = useMemo(() => lastNWeeks(HISTORY_WEEKS), []);

  const entriesQ = useEntries(
    {
      influencerId: usePrefetched ? undefined : influencer._id,
      platform: "onlyfans",
      weekKeys,
    },
    { enabled: !usePrefetched },
  );
  const entries: WeeklyEntry[] = usePrefetched
    ? prefetchedEntries ?? []
    : entriesQ.data ?? [];
  const isLoading = !usePrefetched && entriesQ.isLoading;

  const summary: OnlyFansSummary = useMemo(
    () => onlyFansSummary(entries, weekKeys),
    [entries, weekKeys],
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [modalWeek, setModalWeek] = useState<string>(currentWeekKey());

  const currentWk = currentWeekKey();
  const currentEntered =
    entries.some((e) => e.weekKey === currentWk);

  const openForm = (wk: string) => {
    setModalWeek(wk);
    setModalOpen(true);
  };

  const chartData = useMemo(
    () =>
      summary.weeks.map((w) => ({
        weekKey: w.weekKey,
        label: weekShortLabel(w.weekKey),
        reddit_rev: w.revenue.reddit,
        instagram_rev: w.revenue.instagram,
        x_rev: w.revenue.x,
        reddit_spd: w.spend.reddit,
        instagram_spd: w.spend.instagram,
        x_spd: w.spend.x,
        total_rev: w.totalRevenue,
        total_spd: w.totalSpend,
        net: w.net,
      })),
    [summary.weeks],
  );

  return (
    <>
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="text-xs text-muted-foreground">
          Per-source attribution &middot; last {HISTORY_WEEKS} weeks
        </div>
        {!readOnly && (
          <Button
            size="sm"
            variant={currentEntered ? "outline" : "default"}
            onClick={() => openForm(currentWk)}
          >
            {currentEntered ? (
              <>
                <Pencil className="size-3.5" />
                Edit this week
              </>
            ) : (
              <>
                <Plus className="size-3.5" />
                Log this week
              </>
            )}
          </Button>
        )}
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total revenue"
          value={formatUSD(summary.totals.revenue, { fractional: true })}
          icon={DollarSign}
          accent="success"
          hint={`${HISTORY_WEEKS}-week window`}
        />
        <KpiCard
          label="Total spend"
          value={formatUSD(summary.totals.spend, { fractional: true })}
          icon={Wallet}
          accent="info"
          hint="Ads + content + other costs"
        />
        <KpiCard
          label="Net"
          value={formatUSD(summary.totals.net, { fractional: true })}
          icon={Receipt}
          accent={summary.totals.net >= 0 ? "success" : "instagram"}
          hint={summary.totals.net >= 0 ? "Profit" : "Loss"}
        />
        <KpiCard
          label="ROAS"
          value={
            summary.totals.roas === null
              ? "—"
              : `${summary.totals.roas.toFixed(2)}\u00d7`
          }
          icon={Target}
          accent="primary"
          hint={
            summary.totals.roas === null
              ? "No spend in window"
              : "Revenue per $ spent"
          }
        />
      </div>

      {/* Stacked charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
        <ChartCard
          title="Revenue by source"
          subtitle="Per-week earnings stacked by traffic source"
        >
          <SourceStackedChart
            data={chartData}
            metric="rev"
            loading={isLoading}
          />
        </ChartCard>
        <ChartCard
          title="Spend by source"
          subtitle="Per-week spend stacked by traffic source"
        >
          <SourceStackedChart
            data={chartData}
            metric="spd"
            loading={isLoading}
          />
        </ChartCard>
      </div>

      {/* Per-source mini cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {summary.bySource.map((src) => (
          <SourceCard key={src.source} source={src} />
        ))}
      </div>

      {!readOnly && (
        <EntryFormModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          influencerId={influencer._id}
          influencerName={influencer.name}
          platform="onlyfans"
          weekKey={modalWeek}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

interface SourceStackedChartProps {
  data: Array<Record<string, string | number>>;
  metric: "rev" | "spd";
  loading?: boolean;
}

function SourceStackedChart({ data, metric, loading }: SourceStackedChartProps) {
  if (loading) {
    return <div className="h-[240px] grid place-items-center text-xs text-muted-foreground">Loading…</div>;
  }
  const allZero = data.every((d) =>
    ACQUISITION_PLATFORM_KEYS.every((src) => Number(d[`${src}_${metric}`] ?? 0) === 0),
  );
  if (allZero) {
    return (
      <div className="h-[240px] grid place-items-center text-xs text-muted-foreground border border-dashed border-border rounded-md">
        No {metric === "rev" ? "revenue" : "spend"} entered yet for this window.
      </div>
    );
  }

  return (
    <div className="h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="currentColor" opacity={0.4} />
          <YAxis
            tick={{ fontSize: 10 }}
            stroke="currentColor"
            opacity={0.4}
            width={48}
            tickFormatter={(v) => `$${Number(v).toLocaleString("en-US")}`}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 6,
              fontSize: 11,
            }}
            formatter={(v: number, name) => [
              formatUSD(Number(v), { fractional: true }),
              tooltipLabelFor(name as string),
            ]}
            labelFormatter={(label) => `Week ${label}`}
          />
          {ACQUISITION_PLATFORM_KEYS.map((src) => (
            <Bar
              key={src}
              dataKey={`${src}_${metric}`}
              stackId="src"
              fill={SOURCE_COLOR[src]}
              radius={[0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex items-center gap-3 mt-2 flex-wrap text-[11px] text-muted-foreground">
        {ACQUISITION_PLATFORM_KEYS.map((src) => (
          <div key={src} className="inline-flex items-center gap-1.5">
            <span
              className="size-2 rounded-sm"
              style={{ background: SOURCE_COLOR[src] }}
            />
            {SOURCE_LABEL[src]}
          </div>
        ))}
      </div>
    </div>
  );
}

function tooltipLabelFor(dataKey: string): string {
  const [src, metric] = dataKey.split("_") as [AcquisitionPlatformKey, string];
  const m = metric === "rev" ? "Revenue" : "Spend";
  return `${SOURCE_LABEL[src]} · ${m}`;
}

function SourceCard({ source }: { source: OnlyFansSourceSummary }) {
  const color = SOURCE_COLOR[source.source];
  const positive = source.net >= 0;
  const def = PLATFORMS[source.source];

  return (
    <div className="card-surface rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="size-6 rounded-md"
            style={{ background: color, opacity: 0.2 }}
          />
          <span className="text-sm font-semibold text-foreground">
            {def.label}
          </span>
        </div>
        <span
          className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md"
          style={{ background: `${color}20`, color }}
        >
          {source.roas === null ? "—" : `${source.roas.toFixed(2)}\u00d7 ROAS`}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Stat label="Revenue" value={formatUSD(source.revenue, { fractional: false })} />
        <Stat label="Spend" value={formatUSD(source.spend, { fractional: false })} />
        <Stat
          label="Net"
          value={formatUSD(source.net, { fractional: false })}
          accent={positive ? "text-success" : "text-destructive"}
          icon={
            positive ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )
          }
        />
      </div>
      <Sparkline data={source.weekly} color={color} />
      <div className="text-[10px] text-muted-foreground mt-2 text-center">
        Revenue per week, last {source.weekly.length}
      </div>
    </div>
  );
}

interface SparklineDatum {
  weekKey: string;
  revenue: number;
  spend: number;
}

function Sparkline({ data, color }: { data: SparklineDatum[]; color: string }) {
  if (data.length === 0 || data.every((d) => d.revenue === 0)) {
    return (
      <div className="h-[48px] grid place-items-center text-[10px] text-muted-foreground border border-dashed border-border/60 rounded">
        No entries yet
      </div>
    );
  }
  return (
    <div className="h-[48px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <Line
            type="monotone"
            dataKey="revenue"
            stroke={color}
            strokeWidth={1.75}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-md bg-secondary/40 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-0.5">
        {icon}
        {label}
      </div>
      <div className={`text-sm font-semibold tabular-nums mt-0.5 ${accent ?? "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}
