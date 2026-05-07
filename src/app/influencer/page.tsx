"use client";

/**
 * Influencer personal portal (path: /influencer).
 *
 * Accessible only to sessions with role === "influencer". The proxy redirects
 * any non-influencer session to / and any influencer session trying to access
 * other pages here.
 *
 * Shows:
 *   - Profile card: name + handles
 *   - OnlyFans revenue per source (NO spend, NO ROI, NO ROAS — spend fields
 *     are stripped server-side before the API response reaches the client)
 *   - Per platform stats (followers, karma, posts) — read-only charts
 *   - Subscribers & growth chart (no ROI line since no spend data)
 */

import { useMemo, useState } from "react";
import { LogOut, TrendingUp, DollarSign } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformSection } from "@/components/dashboard/PlatformSection";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";

import { useSession, useLogout } from "@/lib/auth/auth.hooks";
import { useInfluencers } from "@/lib/influencers/influencers.hooks";
import { useEntries } from "@/lib/entries/entries.hooks";
import {
  ACQUISITION_PLATFORM_KEYS,
  type AcquisitionPlatformKey,
  PLATFORMS,
} from "@/lib/platforms/registry";
import { lastNWeeks, weekShortLabel } from "@/lib/utils/week";
import { onlyFansSummary } from "@/lib/utils/derive";
import { formatUSD } from "@/lib/utils/format";

const HISTORY_WEEKS = 12;

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

export default function InfluencerPortal() {
  const { data: session, isLoading: sessionLoading } = useSession();
  const logout = useLogout();
  const router = useRouter();

  const { data: influencers, isLoading: infLoading } = useInfluencers({
    enabled: session?.role === "influencer",
  });

  // For influencer sessions the API returns only their own record.
  const influencer = influencers?.[0] ?? null;

  const weekKeys = useMemo(() => lastNWeeks(HISTORY_WEEKS), []);

  // Fetch all entries — API auto-filters to this influencer and strips spend.
  const entriesQ = useEntries({ weekKeys }, { enabled: !!influencer });
  const allEntries = entriesQ.data ?? [];

  const ofEntries = useMemo(
    () => allEntries.filter((e) => e.platform === "onlyfans"),
    [allEntries],
  );

  const ofSummary = useMemo(
    () => onlyFansSummary(ofEntries, weekKeys),
    [ofEntries, weekKeys],
  );

  const chartData = useMemo(
    () =>
      ofSummary.weeks.map((w) => ({
        label: weekShortLabel(w.weekKey).split(" – ")[0] ?? w.weekKey,
        reddit: w.revenue.reddit,
        instagram: w.revenue.instagram,
        x: w.revenue.x,
      })),
    [ofSummary.weeks],
  );

  const handleLogout = () => {
    logout.mutate(undefined, { onSuccess: () => router.replace("/login") });
  };

  if (sessionLoading || infLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!session || session.role !== "influencer" || !influencer) {
    return null;
  }

  const display = influencer.name || "My Portal";
  const HANDLE_PREFIX: Record<string, string> = {
    reddit: "u/",
    instagram: "@",
    x: "@",
    onlyfans: "@",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border bg-card px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-gradient-primary grid place-items-center shadow-glow shrink-0">
            <span className="text-primary-foreground text-xs font-bold">
              {(display[0] ?? "?").toUpperCase()}
            </span>
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">{display}</div>
            <div className="text-[10px] text-muted-foreground">My portal</div>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={handleLogout}>
          <LogOut className="size-3.5" />
          Sign out
        </Button>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Profile card */}
        <div className="card-surface rounded-xl p-5 flex items-center gap-4">
          <div className="size-14 rounded-2xl bg-gradient-primary grid place-items-center shadow-glow shrink-0">
            <span className="text-primary-foreground text-xl font-bold">
              {(display[0] ?? "?").toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{display}</h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
              {(["reddit", "instagram", "x", "onlyfans"] as const).map((p) => {
                const handle = influencer.handles[p];
                if (!handle) return null;
                return (
                  <span key={p} className="inline-flex items-center gap-1">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: PLATFORMS[p].color }}
                    />
                    {HANDLE_PREFIX[p]}{handle}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* OnlyFans revenue */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <DollarSign className="size-3" />
            OnlyFans · Revenue
          </h2>

          {/* Revenue KPIs per source */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <KpiCard
              label="Total revenue"
              value={formatUSD(ofSummary.totals.revenue, { fractional: true })}
              icon={DollarSign}
              accent="success"
              hint={`${HISTORY_WEEKS}-week window`}
            />
            {ACQUISITION_PLATFORM_KEYS.map((src) => {
              const rev = ofSummary.bySource.find((s) => s.source === src);
              return (
                <KpiCard
                  key={src}
                  label={`From ${SOURCE_LABEL[src]}`}
                  value={formatUSD(rev?.revenue ?? 0, { fractional: true })}
                  icon={TrendingUp}
                  accent="primary"
                  hint={`Revenue via ${SOURCE_LABEL[src]}`}
                />
              );
            })}
          </div>

          {/* Revenue stacked bar chart */}
          <ChartCard
            title="Revenue by source"
            subtitle={`Per-week earnings by traffic source · last ${HISTORY_WEEKS} weeks`}
          >
            {chartData.every((d) =>
              ACQUISITION_PLATFORM_KEYS.every((src) => Number(d[src] ?? 0) === 0),
            ) ? (
              <div className="h-[220px] grid place-items-center text-xs text-muted-foreground border border-dashed border-border rounded-md">
                No revenue data yet for this window.
              </div>
            ) : (
              <>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
                        formatter={(v: number, name: string) => [
                          formatUSD(Number(v), { fractional: true }),
                          SOURCE_LABEL[name as AcquisitionPlatformKey] ?? name,
                        ]}
                        labelFormatter={(label) => `Week ${label}`}
                      />
                      {ACQUISITION_PLATFORM_KEYS.map((src) => (
                        <Bar
                          key={src}
                          dataKey={src}
                          stackId="src"
                          fill={SOURCE_COLOR[src]}
                          radius={[0, 0, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-3 mt-2 flex-wrap text-[11px] text-muted-foreground">
                  {ACQUISITION_PLATFORM_KEYS.map((src) => (
                    <span key={src} className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-sm" style={{ background: SOURCE_COLOR[src] }} />
                      {SOURCE_LABEL[src]}
                    </span>
                  ))}
                </div>
              </>
            )}
          </ChartCard>
        </section>

        {/* Platform stats */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <TrendingUp className="size-3" />
            Platform stats
          </h2>
          <div className="space-y-4">
            {(["reddit", "instagram", "x"] as const).map((platform) => {
              if (!influencer.handles[platform]) return null;
              const platformEntries = allEntries.filter(
                (e) => e.platform === platform,
              );
              return (
                <PlatformSection
                  key={platform}
                  influencer={influencer}
                  platform={platform}
                  prefetchedEntries={platformEntries}
                  readOnly
                />
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
