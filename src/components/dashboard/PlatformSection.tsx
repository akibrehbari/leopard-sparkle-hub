"use client";

/**
 * Per-acquisition-platform section (Reddit / Instagram / X).
 *
 * Renders for one influencer × one platform:
 *   - Headline metric stats: latest cumulative value, weekly delta, average
 *     weekly growth across the visible window.
 *   - Combo chart: cumulative line + weekly delta bars on dual axes.
 *   - Per-week progress dots so the operator can see (and click) which weeks
 *     still need data entered.
 *
 * The component is schema-driven via the platform registry — adding a new
 * cumulative field on Reddit (say) automatically extends the chart's tab
 * picker. OnlyFans is rendered by `OnlyFansAttributionSection` instead, not
 * this component, since its schema is per-source attribution rather than a
 * single cumulative metric.
 */

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { EntryFormModal } from "@/components/entries/EntryFormModal";
import { useEntries } from "@/lib/entries/entries.hooks";
import { usePlatforms } from "@/lib/platforms/platforms.hooks";
import {
  PLATFORMS,
  type PlatformDefinition,
  type PlatformField,
  type PlatformKey,
} from "@/lib/platforms/registry";
import type { Influencer } from "@/lib/influencers/types";
import type { WeeklyEntry } from "@/lib/entries/types";
import { currentWeekKey, lastNWeeks, weekShortLabel } from "@/lib/utils/week";
import { formatNumber, formatSignedInt } from "@/lib/utils/format";
import { deltaSeries, type DeltaPoint } from "@/lib/utils/derive";

const HISTORY_WEEKS = 12;

interface Props {
  influencer: Influencer;
  /** Must be an acquisition platform (reddit / instagram / x). */
  platform: Exclude<PlatformKey, "onlyfans">;
  prefetchedEntries?: WeeklyEntry[];
  prefetchedPlatform?: PlatformDefinition;
  readOnly?: boolean;
}

export function PlatformSection({
  influencer,
  platform,
  prefetchedEntries,
  prefetchedPlatform,
  readOnly,
}: Props) {
  const usePrefetched = prefetchedEntries !== undefined;

  const platformsQ = usePlatforms();
  const platformDef =
    prefetchedPlatform ?? platformsQ.data?.[platform] ?? PLATFORMS[platform];

  const cumulativeFields = useMemo(
    () => platformDef.fields.filter((f) => f.cumulative),
    [platformDef.fields],
  );
  const [activeFieldKey, setActiveFieldKey] = useState<string>(
    () => cumulativeFields[0]?.key ?? platformDef.fields[0]?.key ?? "",
  );
  const activeField: PlatformField | undefined = useMemo(
    () => platformDef.fields.find((f) => f.key === activeFieldKey),
    [platformDef.fields, activeFieldKey],
  );

  const weekKeys = useMemo(() => lastNWeeks(HISTORY_WEEKS), []);
  const entriesQ = useEntries(
    {
      influencerId: usePrefetched ? undefined : influencer._id,
      platform,
      weekKeys,
    },
    { enabled: !usePrefetched },
  );
  const entries: WeeklyEntry[] = usePrefetched
    ? prefetchedEntries ?? []
    : entriesQ.data ?? [];
  const entriesLoading = !usePrefetched && entriesQ.isLoading;

  const [modalOpen, setModalOpen] = useState(false);
  const [modalWeek, setModalWeek] = useState<string>(currentWeekKey());

  const handle = influencer.handles[platform];

  const series: DeltaPoint[] = useMemo(
    () => (activeField ? deltaSeries(entries, weekKeys, activeField.key) : []),
    [entries, weekKeys, activeField],
  );

  const chartData = useMemo(
    () =>
      series.map((p) => ({
        weekKey: p.weekKey,
        label: weekShortLabel(p.weekKey).split(" \u2013 ")[0] ?? p.weekKey,
        cumulative: p.cumulative,
        delta: p.delta,
      })),
    [series],
  );

  const latest = useMemo(() => {
    for (let i = series.length - 1; i >= 0; i -= 1) {
      const p = series[i];
      if (p.cumulative !== null) return p;
    }
    return null;
  }, [series]);

  const weeksLogged = series.filter((p) => p.cumulative !== null).length;
  const totalDelta = series.reduce((sum, p) => sum + (p.delta ?? 0), 0);
  const observedDeltaWeeks = series.filter((p) => p.delta !== null).length;
  const avgWeeklyDelta =
    observedDeltaWeeks > 0 ? totalDelta / observedDeltaWeeks : null;

  const currentWk = currentWeekKey();
  const currentEntered =
    entries.some((e) => e.weekKey === currentWk);

  const openForm = (wk: string) => {
    setModalWeek(wk);
    setModalOpen(true);
  };

  return (
    <>
      <ChartCard
        title={
          <span className="flex items-center gap-2">
            {platformDef.label}
            {handle && (
              <span className="text-xs text-muted-foreground font-normal">
                {platform === "reddit" ? `u/${handle}` : `@${handle}`}
              </span>
            )}
          </span>
        }
        subtitle={`${activeField?.label ?? "Headline metric"} \u00b7 last ${HISTORY_WEEKS} weeks`}
        action={
          readOnly ? null : (
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
          )
        }
      >
        {/* Field switcher (only when more than one cumulative field) */}
        {cumulativeFields.length > 1 && (
          <div className="flex items-center gap-1 mb-4 p-1 rounded-lg bg-secondary/50 border border-border w-fit">
            {cumulativeFields.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFieldKey(f.key)}
                className={[
                  "px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors",
                  f.key === activeFieldKey
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {f.label.replace(/^Total /, "")}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <Stat
            label="Latest"
            value={latest?.cumulative != null ? formatNumber(latest.cumulative) : "\u2014"}
            sub={latest ? weekShortLabel(latest.weekKey) : "no entries yet"}
          />
          <Stat
            label="This week"
            value={(() => {
              const last = chartData[chartData.length - 1];
              if (!last || last.delta === null) return "\u2014";
              return formatSignedInt(last.delta);
            })()}
            sub="vs prior reading"
          />
          <Stat
            label="Avg weekly Δ"
            value={
              avgWeeklyDelta === null
                ? "\u2014"
                : formatSignedInt(Math.round(avgWeeklyDelta))
            }
            sub={`across ${observedDeltaWeeks} week${observedDeltaWeeks === 1 ? "" : "s"}`}
          />
        </div>

        <div className="text-[10px] text-muted-foreground mb-1">
          Weeks logged: {weeksLogged} of {HISTORY_WEEKS}
        </div>

        {entriesLoading ? (
          <Skeleton className="h-[240px] w-full" />
        ) : chartData.every((p) => p.cumulative === null) ? (
          <div className="h-[240px] grid place-items-center text-xs text-muted-foreground border border-dashed border-border rounded-md">
            {readOnly
              ? "No data logged yet."
              : "No data yet \u2014 click \u201cLog this week\u201d to start tracking."}
          </div>
        ) : (
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="currentColor" opacity={0.4} />
                <YAxis
                  yAxisId="cum"
                  tick={{ fontSize: 10 }}
                  stroke="currentColor"
                  opacity={0.4}
                  width={48}
                />
                <YAxis
                  yAxisId="delta"
                  orientation="right"
                  tick={{ fontSize: 10 }}
                  stroke="currentColor"
                  opacity={0.4}
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    fontSize: 11,
                  }}
                  formatter={(v: number, name) => {
                    if (name === "delta") return [formatSignedInt(v), "Weekly Δ"];
                    return [formatNumber(v), "Total"];
                  }}
                  labelFormatter={(label) => `Week ${label}`}
                />
                <Bar
                  yAxisId="delta"
                  dataKey="delta"
                  fill={platformDef.color}
                  opacity={0.45}
                  radius={[2, 2, 0, 0]}
                />
                <Line
                  yAxisId="cum"
                  type="monotone"
                  dataKey="cumulative"
                  stroke={platformDef.color}
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0, fill: platformDef.color }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-[2px]" style={{ background: platformDef.color }} />
                Cumulative total
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-sm" style={{ background: platformDef.color, opacity: 0.45 }} />
                Weekly Δ
              </span>
            </div>
          </div>
        )}

        {/* Per-week progress dots */}
        <div className="flex items-center gap-1 flex-wrap mt-4 pt-3 border-t border-border">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-2">
            Entry progress
          </span>
          {series.map((p) => {
            const filled = p.cumulative !== null;
            const isCurrent = p.weekKey === currentWk;
            const cls = [
              "size-5 rounded-full border text-[9px] grid place-items-center transition-colors",
              filled
                ? "bg-success/80 border-success text-success-foreground"
                : "bg-transparent border-border text-muted-foreground",
              !readOnly && (filled ? "hover:bg-success" : "hover:border-primary"),
              isCurrent ? "ring-2 ring-offset-1 ring-offset-background ring-primary" : "",
            ]
              .filter(Boolean)
              .join(" ");
            const label = p.weekKey.split("W")[1];
            return readOnly ? (
              <span key={p.weekKey} title={`${p.weekKey}${filled ? "" : " \u00b7 not entered"}`} className={cls}>
                {label}
              </span>
            ) : (
              <button
                key={p.weekKey}
                onClick={() => openForm(p.weekKey)}
                title={`${p.weekKey}${filled ? "" : " \u00b7 not entered yet"}`}
                className={cls}
              >
                {label}
              </button>
            );
          })}
        </div>
      </ChartCard>

      {!readOnly && (
        <EntryFormModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          influencerId={influencer._id}
          influencerName={influencer.name}
          platform={platform}
          weekKey={modalWeek}
        />
      )}
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md bg-secondary/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-lg font-semibold text-foreground tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
