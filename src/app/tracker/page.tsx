"use client";

/**
 * Tracker page — the centerpiece for the manual data entry workflow.
 *
 * Layout:
 *   - Left: sticky influencer column (avatar + name)
 *   - Right: scrollable grid of weeks. Each week column is split into
 *     R / IG sub-columns; each cell is a green pill (entered) or outline
 *     (missing). Click any cell to open the form for that
 *     (influencer, platform, week).
 *
 * One round-trip fetches all visible cells via /api/entries with the union
 * of week keys and influencer ids — no per-cell N+1.
 */

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInfluencers } from "@/lib/influencers/influencers.hooks";
import { useEntries } from "@/lib/entries/entries.hooks";
import { usePlatforms } from "@/lib/platforms/platforms.hooks";
import { EntryFormModal } from "@/components/entries/EntryFormModal";
import { currentWeekKey, lastNWeeks, weekShortLabel, parseWeekKey } from "@/lib/utils/week";
import { PLATFORM_KEYS, type PlatformKey } from "@/lib/platforms/registry";
import type { Influencer } from "@/lib/influencers/types";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS = [
  { value: "8", label: "Last 8 weeks" },
  { value: "12", label: "Last 12 weeks" },
  { value: "24", label: "Last 24 weeks" },
];

interface OpenForm {
  influencer: Influencer;
  platform: PlatformKey;
  weekKey: string;
}

export default function TrackerPage() {
  const [weeksBack, setWeeksBack] = useState("12");
  const [search, setSearch] = useState("");
  const [openForm, setOpenForm] = useState<OpenForm | null>(null);

  const { data: platforms } = usePlatforms();
  const { data: influencers, isLoading: infLoading } = useInfluencers();

  const weekKeys = useMemo(() => lastNWeeks(Number(weeksBack)), [weeksBack]);

  const filteredInfluencers = useMemo(() => {
    if (!influencers) return [];
    const q = search.trim().toLowerCase();
    if (!q) return influencers;
    return influencers.filter((i) =>
      [i.name, i.inflowwUserName, i.handles.reddit, i.handles.instagram]
        .filter(Boolean)
        .some((s) => s!.toLowerCase().includes(q)),
    );
  }, [influencers, search]);

  const entriesQ = useEntries(
    { weekKeys },
    { enabled: weekKeys.length > 0 },
  );

  /** Map: `${influencerId}|${platform}|${weekKey}` → true if entered. */
  const entriesIndex = useMemo(() => {
    const set = new Set<string>();
    for (const e of entriesQ.data ?? []) {
      set.add(`${e.influencerId}|${e.platform}|${e.weekKey}`);
    }
    return set;
  }, [entriesQ.data]);

  const isFilled = (influencerId: string, platform: PlatformKey, weekKey: string) =>
    entriesIndex.has(`${influencerId}|${platform}|${weekKey}`);

  const currentWk = currentWeekKey();

  return (
    <AppShell>
      <div className="px-6 py-6">
        <header className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-semibold">Weekly tracker</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Click any cell to log or edit data for that influencer/platform/week.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search influencer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-56"
            />
            <Select value={weeksBack} onValueChange={setWeeksBack}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        <Legend />

        {infLoading ? (
          <div className="card-surface rounded-xl p-6 space-y-2 mt-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !influencers || influencers.length === 0 ? (
          <div className="card-surface rounded-xl p-12 text-center text-sm text-muted-foreground mt-4">
            No influencers yet. Go to the{" "}
            <a href="/influencers" className="text-primary hover:underline">
              Influencers
            </a>{" "}
            page and click <strong>Sync Infloww accounts</strong>.
          </div>
        ) : (
          <div className="card-surface rounded-xl overflow-hidden mt-4">
            <div className="overflow-x-auto">
              <div className="grid" style={gridStyle(weekKeys.length)}>
                {/* Header row */}
                <div className="sticky left-0 z-20 bg-card border-b border-r border-border px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Influencer
                </div>
                {weekKeys.map((wk) => {
                  const isCurrent = wk === currentWk;
                  return (
                    <div
                      key={`h-${wk}`}
                      className={cn(
                        "border-b border-border px-2 py-2 text-center text-[10px]",
                        isCurrent && "bg-primary/5",
                      )}
                    >
                      <div className="font-medium text-foreground">
                        {parseWeekKey(wk)?.week
                          ? `W${String(parseWeekKey(wk)!.week).padStart(2, "0")}`
                          : wk}
                      </div>
                      <div className="text-muted-foreground text-[9px] mt-0.5">
                        {weekShortLabel(wk).split("·")[1]?.trim() ?? ""}
                      </div>
                      <div className="flex justify-center gap-1.5 mt-1.5">
                        {PLATFORM_KEYS.map((p) => (
                          <span
                            key={p}
                            className="text-[9px] uppercase tracking-wider text-muted-foreground w-6 text-center"
                          >
                            {platforms?.[p]?.short ?? p[0]}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Body rows */}
                {filteredInfluencers.length === 0 ? (
                  <div
                    className="text-xs text-muted-foreground text-center py-10"
                    style={{ gridColumn: `span ${weekKeys.length + 1}` }}
                  >
                    No influencers match &ldquo;{search}&rdquo;.
                  </div>
                ) : (
                  filteredInfluencers.map((inf) => (
                    <TrackerRow
                      key={inf._id}
                      influencer={inf}
                      weekKeys={weekKeys}
                      currentWk={currentWk}
                      isFilled={isFilled}
                      onCellClick={(platform, weekKey) =>
                        setOpenForm({ influencer: inf, platform, weekKey })
                      }
                    />
                  ))
                )}
              </div>
            </div>
            {entriesQ.isLoading && (
              <div className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground flex items-center gap-2">
                <Loader2 className="size-3 animate-spin" />
                Loading entries…
              </div>
            )}
          </div>
        )}
      </div>

      {openForm && (
        <EntryFormModal
          open={Boolean(openForm)}
          onOpenChange={(o) => !o && setOpenForm(null)}
          influencerId={openForm.influencer._id}
          influencerName={openForm.influencer.name}
          platform={openForm.platform}
          weekKey={openForm.weekKey}
        />
      )}
    </AppShell>
  );
}

/* -------------------------------------------------------------------------- */

function gridStyle(numWeeks: number): React.CSSProperties {
  return {
    gridTemplateColumns: `minmax(220px, 1.5fr) repeat(${numWeeks}, minmax(110px, 1fr))`,
  };
}

function TrackerRow({
  influencer,
  weekKeys,
  currentWk,
  isFilled,
  onCellClick,
}: {
  influencer: Influencer;
  weekKeys: string[];
  currentWk: string;
  isFilled: (id: string, p: PlatformKey, w: string) => boolean;
  onCellClick: (platform: PlatformKey, weekKey: string) => void;
}) {
  return (
    <>
      <div className="sticky left-0 z-10 bg-card border-b border-r border-border px-4 py-2 flex items-center gap-2.5 min-w-0">
        <div className="size-7 rounded-full bg-gradient-primary grid place-items-center shrink-0">
          <span className="text-primary-foreground text-[11px] font-semibold">
            {(influencer.name[0] ?? "?").toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground truncate">
            {influencer.name}
          </div>
          <div className="text-[10px] text-muted-foreground truncate">
            {influencer.inflowwUserName ? `@${influencer.inflowwUserName}` : "Manual"}
          </div>
        </div>
      </div>
      {weekKeys.map((wk) => {
        const isCurrent = wk === currentWk;
        return (
          <div
            key={`${influencer._id}-${wk}`}
            className={cn(
              "border-b border-border px-2 py-2 flex items-center justify-center gap-1.5",
              isCurrent && "bg-primary/5",
            )}
          >
            {PLATFORM_KEYS.map((p) => {
              const filled = isFilled(influencer._id, p, wk);
              return (
                <button
                  key={p}
                  onClick={() => onCellClick(p, wk)}
                  title={`${influencer.name} · ${p} · ${wk}${
                    filled ? " (entered)" : " (click to log)"
                  }`}
                  className={cn(
                    "w-6 h-5 rounded-full border text-[8px] font-semibold transition-colors",
                    filled
                      ? "bg-success/80 border-success text-success-foreground hover:bg-success"
                      : "bg-transparent border-border text-muted-foreground hover:border-primary hover:text-primary",
                  )}
                >
                  {filled ? "✓" : ""}
                </button>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="w-5 h-4 rounded-full bg-success/80 border border-success grid place-items-center text-success-foreground text-[8px] font-bold">
          ✓
        </span>
        Entered
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-5 h-4 rounded-full border border-border" />
        Not entered yet · click to log
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-sm bg-primary/20" />
        Current week
      </span>
    </div>
  );
}
