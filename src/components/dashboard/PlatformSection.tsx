"use client";

/**
 * Per-platform section for the influencer dashboard.
 *
 * Shows the latest weekly entry plus a 12-week sparkline of the platform's
 * "headline" metric (the first field in the registry, treated as required).
 * Receives the influencer directly so we don't double-look-up.
 */

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { useEntries } from "@/lib/entries/entries.hooks";
import { usePlatforms } from "@/lib/platforms/platforms.hooks";
import { EntryFormModal } from "@/components/entries/EntryFormModal";
import type { PlatformKey } from "@/lib/platforms/registry";
import type { Influencer } from "@/lib/influencers/types";
import { currentWeekKey, lastNWeeks, weekShortLabel } from "@/lib/utils/week";
import { formatNumber } from "@/lib/infloww/util";

interface Props {
  influencer: Influencer;
  platform: PlatformKey;
}

const HISTORY_WEEKS = 12;

export function PlatformSection({ influencer, platform }: Props) {
  const { data: platforms } = usePlatforms();
  const platformDef = platforms?.[platform];

  const weekKeys = useMemo(() => lastNWeeks(HISTORY_WEEKS), []);
  const entriesQ = useEntries({
    influencerId: influencer._id,
    platform,
    weekKeys,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalWeek, setModalWeek] = useState<string>(currentWeekKey());

  const headlineField = platformDef?.fields[0];
  const handle = influencer.handles[platform];

  const entriesByWeek = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const wk of weekKeys) map.set(wk, null);
    for (const e of entriesQ.data ?? []) {
      const v = headlineField ? e.data?.[headlineField.key] : undefined;
      if (typeof v === "number") map.set(e.weekKey, v);
    }
    return map;
  }, [entriesQ.data, weekKeys, headlineField]);

  const chartData = useMemo(
    () =>
      weekKeys.map((wk) => ({
        weekKey: wk,
        label: wk.slice(5),
        value: entriesByWeek.get(wk),
      })),
    [weekKeys, entriesByWeek],
  );

  const latest = useMemo(() => {
    for (let i = weekKeys.length - 1; i >= 0; i -= 1) {
      const wk = weekKeys[i];
      const v = entriesByWeek.get(wk);
      if (typeof v === "number") return { weekKey: wk, value: v };
    }
    return null;
  }, [weekKeys, entriesByWeek]);

  const currentWk = currentWeekKey();
  const currentEntered = entriesByWeek.get(currentWk) !== null;

  const openForm = (wk: string) => {
    setModalWeek(wk);
    setModalOpen(true);
  };

  return (
    <>
      <ChartCard
        title={
          <span className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-full"
              style={{ background: platformDef?.color ?? "#888" }}
            />
            {platformDef?.label ?? platform}
            {handle && (
              <span className="text-xs text-muted-foreground font-normal">
                {platform === "reddit" ? `u/${handle}` : `@${handle}`}
              </span>
            )}
          </span>
        }
        subtitle={`${headlineField?.label ?? "Headline metric"} · last ${HISTORY_WEEKS} weeks`}
        action={
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
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <Stat
            label="Latest"
            value={latest ? formatNumber(latest.value) : "—"}
            sub={latest ? weekShortLabel(latest.weekKey) : "no entries yet"}
          />
          <Stat
            label="Weeks logged"
            value={String(
              weekKeys.filter((wk) => entriesByWeek.get(wk) !== null).length,
            )}
            sub={`of ${HISTORY_WEEKS}`}
          />
          <Stat
            label="Change vs prior"
            value={changeLabel(chartData)}
            sub="last 2 weeks"
          />
        </div>

        {entriesQ.isLoading ? (
          <Skeleton className="h-[180px] w-full" />
        ) : chartData.every((p) => p.value === null) ? (
          <div className="h-[180px] grid place-items-center text-xs text-muted-foreground border border-dashed border-border rounded-md">
            No data yet — click &ldquo;Log this week&rdquo; to start tracking.
          </div>
        ) : (
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="currentColor" opacity={0.4} />
                <YAxis tick={{ fontSize: 10 }} stroke="currentColor" opacity={0.4} width={40} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    fontSize: 11,
                  }}
                  formatter={(v) =>
                    typeof v === "number" ? formatNumber(v) : "—"
                  }
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={platformDef?.color ?? "hsl(var(--primary))"}
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0, fill: platformDef?.color ?? "currentColor" }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Per-week progress dots */}
        <div className="flex items-center gap-1 flex-wrap mt-4 pt-3 border-t border-border">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-2">
            Entry progress
          </span>
          {weekKeys.map((wk) => {
            const filled = entriesByWeek.get(wk) !== null;
            const isCurrent = wk === currentWk;
            return (
              <button
                key={wk}
                onClick={() => openForm(wk)}
                title={`${wk}${filled ? "" : " · not entered yet"}`}
                className={[
                  "size-5 rounded-full border text-[9px] grid place-items-center transition-colors",
                  filled
                    ? "bg-success/80 border-success text-success-foreground hover:bg-success"
                    : "bg-transparent border-border text-muted-foreground hover:border-primary",
                  isCurrent ? "ring-2 ring-offset-1 ring-offset-background ring-primary" : "",
                ].join(" ")}
              >
                {wk.split("W")[1]}
              </button>
            );
          })}
        </div>
      </ChartCard>

      <EntryFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        influencerId={influencer._id}
        influencerName={influencer.name}
        platform={platform}
        weekKey={modalWeek}
      />
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

function changeLabel(data: { value: number | null }[]): string {
  const filled = data.filter((p) => typeof p.value === "number") as { value: number }[];
  if (filled.length < 2) return "—";
  const last = filled[filled.length - 1].value;
  const prev = filled[filled.length - 2].value;
  if (prev === 0) return last > 0 ? "+∞" : "0";
  const pct = ((last - prev) / prev) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}
