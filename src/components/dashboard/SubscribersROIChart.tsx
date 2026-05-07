"use client";

/**
 * Combined chart: all-platform follower/subscriber counts (left axis) +
 * OnlyFans ROI % (right axis), over the last N weeks.
 *
 * Each acquisition platform's followers are shown as lines using their brand
 * colors. OnlyFans subscribers (if logged) appear as a separate line.
 * ROI = (revenue - spend) / spend × 100 is overlaid as a dashed line on the
 * right axis.
 */

import { useMemo } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartCard } from "@/components/dashboard/ChartCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useEntries } from "@/lib/entries/entries.hooks";
import { PLATFORMS } from "@/lib/platforms/registry";
import type { Influencer } from "@/lib/influencers/types";
import { lastNWeeks, weekShortLabel } from "@/lib/utils/week";
import { formatCompact, formatPercent } from "@/lib/utils/format";
import { subscribersROISeries, type SubscribersROIPoint } from "@/lib/utils/derive";

const HISTORY_WEEKS = 12;

const PLATFORM_LINES: {
  key: keyof Pick<SubscribersROIPoint, "reddit" | "instagram" | "x" | "onlyfans">;
  label: string;
  color: string;
}[] = [
  { key: "reddit", label: "Reddit followers", color: PLATFORMS.reddit.color },
  { key: "instagram", label: "Instagram followers", color: PLATFORMS.instagram.color },
  { key: "x", label: "X followers", color: PLATFORMS.x.color },
  { key: "onlyfans", label: "OF subscribers", color: PLATFORMS.onlyfans.color },
];

interface Props {
  influencer: Influencer;
}

export function SubscribersROIChart({ influencer }: Props) {
  const weekKeys = useMemo(() => lastNWeeks(HISTORY_WEEKS), []);

  const entriesQ = useEntries({ influencerId: influencer._id, weekKeys });
  const entries = entriesQ.data ?? [];

  const series = useMemo(
    () => subscribersROISeries(entries, weekKeys, (wk) => weekShortLabel(wk).split(" – ")[0] ?? wk),
    [entries, weekKeys],
  );

  const hasSubscriberData = series.some(
    (p) => p.reddit !== null || p.instagram !== null || p.x !== null || p.onlyfans !== null,
  );
  const hasROIData = series.some((p) => p.roi !== null);
  const isEmpty = !hasSubscriberData && !hasROIData;

  return (
    <ChartCard
      title="Subscribers & ROI"
      subtitle={`Follower/subscriber counts per platform · ROI % · last ${HISTORY_WEEKS} weeks`}
    >
      {entriesQ.isLoading ? (
        <Skeleton className="h-[280px] w-full" />
      ) : isEmpty ? (
        <div className="h-[280px] grid place-items-center text-xs text-muted-foreground border border-dashed border-border rounded-md">
          No data yet — log weekly entries to start tracking subscribers & ROI.
        </div>
      ) : (
        <>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  stroke="currentColor"
                  opacity={0.4}
                />
                <YAxis
                  yAxisId="subs"
                  tick={{ fontSize: 10 }}
                  stroke="currentColor"
                  opacity={0.4}
                  width={52}
                  tickFormatter={formatCompact}
                />
                {hasROIData && (
                  <YAxis
                    yAxisId="roi"
                    orientation="right"
                    tick={{ fontSize: 10 }}
                    stroke="currentColor"
                    opacity={0.4}
                    width={44}
                    tickFormatter={(v) => `${Math.round(v)}%`}
                  />
                )}
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    fontSize: 11,
                  }}
                  formatter={(v: number, name: string) => {
                    if (name === "roi") return [formatPercent(v, 1), "ROI"];
                    const line = PLATFORM_LINES.find((l) => l.key === name);
                    return [formatCompact(v), line?.label ?? name];
                  }}
                  labelFormatter={(label) => `Week ${label}`}
                />
                {hasROIData && (
                  <ReferenceLine yAxisId="roi" y={0} stroke="hsl(var(--border))" strokeDasharray="4 2" />
                )}

                {/* Subscriber/follower lines */}
                {PLATFORM_LINES.map(({ key, color }) => (
                  <Line
                    key={key}
                    yAxisId="subs"
                    type="monotone"
                    dataKey={key}
                    stroke={color}
                    strokeWidth={2}
                    dot={{ r: 3, strokeWidth: 0, fill: color }}
                    connectNulls
                  />
                ))}

                {/* ROI % line */}
                {hasROIData && (
                  <Line
                    yAxisId="roi"
                    type="monotone"
                    dataKey="roi"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    dot={{ r: 3, strokeWidth: 0, fill: "hsl(var(--primary))" }}
                    connectNulls
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-[11px] text-muted-foreground">
            {PLATFORM_LINES.map(({ key, label, color }) => {
              const hasData = series.some((p) => p[key] !== null);
              if (!hasData) return null;
              return (
                <span key={key} className="inline-flex items-center gap-1.5">
                  <span className="w-4 h-[2px]" style={{ background: color }} />
                  {label}
                </span>
              );
            })}
            {hasROIData && (
              <span className="inline-flex items-center gap-1.5">
                <svg width="16" height="2" viewBox="0 0 16 2">
                  <line x1="0" y1="1" x2="16" y2="1" stroke="hsl(var(--primary))" strokeWidth="2" strokeDasharray="6 3" />
                </svg>
                ROI % (right axis)
              </span>
            )}
          </div>
        </>
      )}
    </ChartCard>
  );
}
