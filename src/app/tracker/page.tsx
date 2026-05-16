"use client";

/**
 * Tracker page — manual data entry for influencers and subreddits.
 *
 * Toggle between two grids:
 *   Influencers — one circle per platform per week
 *   Subreddits  — one circle per subreddit per week
 */

import { useMemo, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInfluencers } from "@/lib/influencers/influencers.hooks";
import { useSubreddits } from "@/lib/subreddits/subreddits.hooks";
import { useSubredditSnapshots } from "@/lib/subreddits/subreddits.hooks";
import { useEntries } from "@/lib/entries/entries.hooks";
import { usePlatforms } from "@/lib/platforms/platforms.hooks";
import { useSession } from "@/lib/auth/auth.hooks";
import { isEditorOrAdmin } from "@/lib/auth/roles";
import { EntryFormModal } from "@/components/entries/EntryFormModal";
import { SubredditEntryDialog } from "@/components/subreddits/SubredditEntryDialog";
import { currentWeekKey, lastNWeeks, weekShortLabel, parseWeekKey } from "@/lib/utils/week";
import { PLATFORM_KEYS, type PlatformKey } from "@/lib/platforms/registry";
import type { Influencer } from "@/lib/influencers/types";
import type { SubredditWithLatest } from "@/lib/subreddits/types";
import { categoryLabel } from "@/lib/subreddits/categories";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS = [
  { value: "2", label: "Last 2 weeks" },
  { value: "4", label: "Last 4 weeks" },
  { value: "8", label: "Last 8 weeks" },
  { value: "12", label: "Last 12 weeks" },
  { value: "24", label: "Last 24 weeks" },
];

type TrackerView = "influencers" | "subreddits";

interface OpenInfluencerForm {
  influencer: Influencer;
  platform: PlatformKey;
  weekKey: string;
}

interface OpenSubredditForm {
  subreddit: SubredditWithLatest;
  weekKey: string;
}

export default function TrackerPage() {
  const [weeksBack, setWeeksBack] = useState("12");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<TrackerView>("influencers");
  const [openForm, setOpenForm] = useState<OpenInfluencerForm | null>(null);
  const [openSubForm, setOpenSubForm] = useState<OpenSubredditForm | null>(null);

  const { data: session, isLoading: sessionLoading } = useSession();
  const allowed = isEditorOrAdmin(session?.role);

  const { data: platforms } = usePlatforms();
  const { data: influencers, isLoading: infLoading } = useInfluencers({ enabled: allowed });
  const { data: subreddits, isLoading: subLoading } = useSubreddits();

  const weekKeys = useMemo(() => lastNWeeks(Number(weeksBack)), [weeksBack]);

  const entriesQ = useEntries({ weekKeys }, { enabled: allowed && weekKeys.length > 0 && view === "influencers" });
  const snapshotsQ = useSubredditSnapshots(view === "subreddits" ? weekKeys : []);

  if (sessionLoading) {
    return (
      <AppShell>
        <div className="px-6 py-6 max-w-6xl">
          <Skeleton className="h-8 w-48" />
        </div>
      </AppShell>
    );
  }

  if (!allowed) {
    return (
      <AppShell>
        <div className="px-6 py-12 max-w-2xl mx-auto">
          <div className="card-surface rounded-xl p-8 text-center">
            <div className="mx-auto size-12 rounded-full bg-destructive/10 grid place-items-center mb-4">
              <ShieldAlert className="size-5 text-destructive" />
            </div>
            <h1 className="text-lg font-semibold mb-1">Read-only role</h1>
            <p className="text-sm text-muted-foreground">
              The weekly tracker is for entering data. Your role can view
              dashboards but not modify weekly entries.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  const filteredInfluencers = (() => {
    if (!influencers) return [];
    const q = search.trim().toLowerCase();
    if (!q) return influencers;
    return influencers.filter((i) =>
      [i.name, ...PLATFORM_KEYS.flatMap((k) => i.handles[k] ?? [])]
        .filter(Boolean)
        .some((s) => s!.toLowerCase().includes(q)),
    );
  })();

  const filteredSubreddits = (() => {
    if (!subreddits) return [];
    const q = search.trim().toLowerCase();
    if (!q) return subreddits;
    return subreddits.filter((s) =>
      s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q),
    );
  })();

  /** Map: `${influencerId}|${platform}|${weekKey}` → true */
  const entriesIndex = useMemo(() => {
    const set = new Set<string>();
    for (const e of entriesQ.data ?? []) {
      set.add(`${e.influencerId}|${e.platform}|${e.weekKey}`);
    }
    return set;
  }, [entriesQ.data]);

  /** Map: `${subredditId}|${weekKey}` → true */
  const snapshotsIndex = useMemo(() => {
    const set = new Set<string>();
    for (const s of snapshotsQ.data ?? []) {
      set.add(`${s.subredditId}|${s.weekKey}`);
    }
    return set;
  }, [snapshotsQ.data]);

  const isFilled = (influencerId: string, platform: PlatformKey, weekKey: string) =>
    entriesIndex.has(`${influencerId}|${platform}|${weekKey}`);

  const isSubFilled = (subredditId: string, weekKey: string) =>
    snapshotsIndex.has(`${subredditId}|${weekKey}`);

  const currentWk = currentWeekKey();

  return (
    <AppShell>
      <div className="px-6 py-6">
        <header className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-semibold">Weekly tracker</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Click any cell to log or edit data for that {view === "influencers" ? "influencer/platform" : "subreddit"}/week.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder={view === "influencers" ? "Search influencer…" : "Search subreddit…"}
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

        {/* View toggle */}
        <div className="flex items-center gap-1 mb-4 p-1 rounded-lg bg-secondary/50 border border-border w-fit">
          <button
            onClick={() => { setView("influencers"); setSearch(""); }}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
              view === "influencers"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Influencers
          </button>
          <button
            onClick={() => { setView("subreddits"); setSearch(""); }}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
              view === "subreddits"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Subreddits
          </button>
        </div>

        <Legend view={view} />

        {/* Influencers grid */}
        {view === "influencers" && (
          infLoading ? (
            <div className="card-surface rounded-xl p-6 space-y-2 mt-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !influencers || influencers.length === 0 ? (
            <div className="card-surface rounded-xl p-12 text-center text-sm text-muted-foreground mt-4">
              No influencers yet. Go to the{" "}
              <a href="/influencers" className="text-primary hover:underline">Influencers</a>{" "}
              page and click <strong>Add influencer</strong>.
            </div>
          ) : (
            <div className="card-surface rounded-xl overflow-hidden mt-4">
              <div className="overflow-x-auto">
                <div className="grid" style={gridStyle(weekKeys.length)}>
                  <div className="sticky left-0 z-20 bg-card border-b border-r border-border px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    Influencer
                  </div>
                  {weekKeys.map((wk) => (
                    <WeekHeader key={wk} wk={wk} currentWk={currentWk} platforms={platforms} showPlatforms />
                  ))}
                  {filteredInfluencers.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-10" style={{ gridColumn: `span ${weekKeys.length + 1}` }}>
                      No influencers match &ldquo;{search}&rdquo;.
                    </div>
                  ) : (
                    filteredInfluencers.map((inf) => (
                      <InfluencerRow
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
          )
        )}

        {/* Subreddits grid */}
        {view === "subreddits" && (
          subLoading ? (
            <div className="card-surface rounded-xl p-6 space-y-2 mt-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !subreddits || subreddits.length === 0 ? (
            <div className="card-surface rounded-xl p-12 text-center text-sm text-muted-foreground mt-4">
              No subreddits yet. Go to the{" "}
              <a href="/subreddits" className="text-primary hover:underline">Subreddits</a>{" "}
              page and click <strong>Add subreddit</strong>.
            </div>
          ) : (
            <div className="card-surface rounded-xl overflow-hidden mt-4">
              <div className="overflow-x-auto">
                <div className="grid" style={subGridStyle(weekKeys.length)}>
                  <div className="sticky left-0 z-20 bg-card border-b border-r border-border px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    Subreddit
                  </div>
                  {weekKeys.map((wk) => (
                    <WeekHeader key={wk} wk={wk} currentWk={currentWk} showPlatforms={false} />
                  ))}
                  {filteredSubreddits.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-10" style={{ gridColumn: `span ${weekKeys.length + 1}` }}>
                      No subreddits match &ldquo;{search}&rdquo;.
                    </div>
                  ) : (
                    filteredSubreddits.map((sub) => (
                      <SubredditRow
                        key={sub._id}
                        subreddit={sub}
                        weekKeys={weekKeys}
                        currentWk={currentWk}
                        isFilled={(wk) => isSubFilled(sub._id, wk)}
                        onCellClick={(weekKey) => setOpenSubForm({ subreddit: sub, weekKey })}
                      />
                    ))
                  )}
                </div>
              </div>
              {snapshotsQ.isLoading && (
                <div className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground flex items-center gap-2">
                  <Loader2 className="size-3 animate-spin" />
                  Loading snapshots…
                </div>
              )}
            </div>
          )
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
          influencerHandles={openForm.influencer.handles}
        />
      )}

      <SubredditEntryDialog
        subreddit={openSubForm?.subreddit ?? null}
        open={Boolean(openSubForm)}
        onOpenChange={(o) => !o && setOpenSubForm(null)}
        initialWeekKey={openSubForm?.weekKey}
      />
    </AppShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  Shared helpers                                                             */
/* -------------------------------------------------------------------------- */

function gridStyle(numWeeks: number): React.CSSProperties {
  return {
    gridTemplateColumns: `minmax(220px, 1.5fr) repeat(${numWeeks}, minmax(140px, 1fr))`,
  };
}

function subGridStyle(numWeeks: number): React.CSSProperties {
  return {
    gridTemplateColumns: `minmax(220px, 1.5fr) repeat(${numWeeks}, minmax(90px, 1fr))`,
  };
}

function WeekHeader({
  wk,
  currentWk,
  platforms,
  showPlatforms,
}: {
  wk: string;
  currentWk: string;
  platforms?: Record<string, { short: string }> | undefined;
  showPlatforms: boolean;
}) {
  const isCurrent = wk === currentWk;
  return (
    <div
      className={cn(
        "border-b border-border px-2 py-2 text-center text-[10px]",
        isCurrent && "bg-primary/5",
      )}
    >
      <div className="font-medium text-foreground">
        {parseWeekKey(wk)?.week ? `W${String(parseWeekKey(wk)!.week).padStart(2, "0")}` : wk}
      </div>
      <div className="text-muted-foreground text-[9px] mt-0.5">
        {weekShortLabel(wk).split("·")[1]?.trim() ?? ""}
      </div>
      {showPlatforms && (
        <div className="flex justify-center gap-1.5 mt-1.5">
          {PLATFORM_KEYS.map((p) => (
            <span key={p} className="text-[9px] uppercase tracking-wider text-muted-foreground w-6 text-center">
              {platforms?.[p]?.short ?? p[0]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Influencer row                                                             */
/* -------------------------------------------------------------------------- */

function InfluencerRow({
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
          <div className="text-sm font-medium text-foreground truncate">{influencer.name}</div>
          <div className="text-[10px] text-muted-foreground truncate">
            {(() => {
              const linked = PLATFORM_KEYS.filter((k) => influencer.handles[k]);
              return linked.length > 0
                ? linked.map((k) => k === "x" ? "X" : k.charAt(0).toUpperCase() + k.slice(1)).join(" · ")
                : "No handles linked";
            })()}
          </div>
        </div>
      </div>
      {weekKeys.map((wk) => {
        const isCurrent = wk === currentWk;
        return (
          <div
            key={`${influencer._id}-${wk}`}
            className={cn("border-b border-border px-2 py-2 flex items-center justify-center gap-1.5", isCurrent && "bg-primary/5")}
          >
            {PLATFORM_KEYS.map((p) => {
              const filled = isFilled(influencer._id, p, wk);
              return (
                <button
                  key={p}
                  onClick={() => onCellClick(p, wk)}
                  title={`${influencer.name} · ${p} · ${wk}${filled ? " (entered)" : " (click to log)"}`}
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

/* -------------------------------------------------------------------------- */
/*  Subreddit row                                                              */
/* -------------------------------------------------------------------------- */

function SubredditRow({
  subreddit,
  weekKeys,
  currentWk,
  isFilled,
  onCellClick,
}: {
  subreddit: SubredditWithLatest;
  weekKeys: string[];
  currentWk: string;
  isFilled: (wk: string) => boolean;
  onCellClick: (weekKey: string) => void;
}) {
  return (
    <>
      <div className="sticky left-0 z-10 bg-card border-b border-r border-border px-4 py-2 flex items-center gap-2.5 min-w-0">
        <div className="size-7 rounded-full bg-[#FF4500]/20 border border-[#FF4500]/40 grid place-items-center shrink-0">
          <span className="text-[#FF4500] text-[10px] font-bold">r/</span>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground truncate">r/{subreddit.displayName}</div>
          <div className="text-[10px] text-muted-foreground truncate">{categoryLabel(subreddit.category)}</div>
        </div>
      </div>
      {weekKeys.map((wk) => {
        const isCurrent = wk === currentWk;
        const filled = isFilled(wk);
        return (
          <div
            key={`${subreddit._id}-${wk}`}
            className={cn("border-b border-border px-2 py-2 flex items-center justify-center", isCurrent && "bg-primary/5")}
          >
            <button
              onClick={() => onCellClick(wk)}
              title={`r/${subreddit.name} · ${wk}${filled ? " (entered)" : " (click to log)"}`}
              className={cn(
                "w-6 h-5 rounded-full border text-[8px] font-semibold transition-colors",
                filled
                  ? "bg-success/80 border-success text-success-foreground hover:bg-success"
                  : "bg-transparent border-border text-muted-foreground hover:border-primary hover:text-primary",
              )}
            >
              {filled ? "✓" : ""}
            </button>
          </div>
        );
      })}
    </>
  );
}

/* -------------------------------------------------------------------------- */

function Legend({ view }: { view: TrackerView }) {
  return (
    <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="w-5 h-4 rounded-full bg-success/80 border border-success grid place-items-center text-success-foreground text-[8px] font-bold">✓</span>
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
      {view === "subreddits" && (
        <span className="text-muted-foreground">
          Each cell = followers · contributions · weekly visits
        </span>
      )}
    </div>
  );
}
