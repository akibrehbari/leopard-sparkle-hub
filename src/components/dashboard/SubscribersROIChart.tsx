"use client";

/**
 * Multi-line subscribers chart — one coloured line per platform/acquisition source.
 *
 * Shows follower/subscriber counts for every platform the influencer is active
 * on (derived from their handles), over the last N weeks. Only platforms with
 * a handle set are rendered.
 */

import { useMemo } from "react";
import {
  CartesianGrid,
  LineChart,
  Line,
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
import { formatCompact } from "@/lib/utils/format";
import { subscribersROISeries, type SubscribersROIPoint } from "@/lib/utils/derive";

const HISTORY_WEEKS = 12;

const PLATFORM_LINES: {
  key: keyof Pick<SubscribersROIPoint, "reddit" | "instagram" | "x" | "onlyfans">;
  label: string;
  color: string;
}[] = [
  { key: "reddit",    label: "Reddit followers",    color: PLATFORMS.reddit.color },
  { key: "instagram", label: "Instagram followers",  color: PLATFORMS.instagram.color },
  { key: "x",         label: "X followers",          color: PLATFORMS.x.color },
  { key: "onlyfans",  label: "OF subscribers",       color: PLATFORMS.onlyfans.color },
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

  /** Only show lines for platforms the influencer is actually on. */
  const activePlatformLines = useMemo(
    () =>
      PLATFORM_LINES.filter(({ key }) =>
        key === "onlyfans"
          ? !!influencer.handles?.onlyfans
          : !!influencer.handles?.[key as "reddit" | "instagram" | "x"],
      ),
    [influencer.handles],
  );

  const hasData = series.some(
    (p) => activePlatformLines.some(({ key }) => p[key] !== null),
  );

  return (
    <ChartCard
      title="Subscribers"
      subtitle={`Follower & subscriber counts per platform · last ${HISTORY_WEEKS} weeks`}
    >
      {entriesQ.isLoading ? (
        <Skeleton className="h-[280px] w-full" />
      ) : !hasData ? (
        <div className="h-[280px] grid place-items-center text-xs text-muted-foreground border border-dashed border-border rounded-md">
          No data yet — log weekly entries to start tracking subscribers.
        </div>
      ) : (
        <>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  stroke="currentColor"
                  opacity={0.4}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  stroke="currentColor"
                  opacity={0.4}
                  width={52}
                  tickFormatter={formatCompact}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    fontSize: 11,
                  }}
                  formatter={(v: number, name: string) => {
                    const line = activePlatformLines.find((l) => l.key === name);
                    return [formatCompact(v), line?.label ?? name];
                  }}
                  labelFormatter={(label) => `Week ${label}`}
                />

                {activePlatformLines.map(({ key, color }) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={color}
                    strokeWidth={2.5}
                    dot={{ r: 3.5, strokeWidth: 0, fill: color }}
                    activeDot={{ r: 5, strokeWidth: 0, fill: color }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 text-[11px] text-muted-foreground">
            {activePlatformLines.map(({ key, label, color }) => {
              const hasLineData = series.some((p) => p[key] !== null);
              if (!hasLineData) return null;
              return (
                <span key={key} className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block w-4 rounded-full"
                    style={{ height: 3, background: color }}
                  />
                  {label}
                </span>
              );
            })}
          </div>
        </>
      )}
    </ChartCard>
  );
}
