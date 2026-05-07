"use client";

/**
 * Dashboard page (path: /).
 *
 * URL state:
 *   ?id=<influencerId> — show that influencer's dashboard
 *   ?id=all (or no ?id) — show the cross-platform "All Models" overview
 *
 * Layout for a single influencer (top to bottom):
 *   - Topbar (range pills + Export dropdown)
 *   - ModelOverview (avatar + handles)
 *   - OnlyFans → OnlyFansAttributionSection (KPIs, stacked charts, per-source cards)
 *   - Reddit → PlatformSection (cumulative line + delta bars)
 *   - Instagram → same shape
 *   - X → same shape
 *
 * For the All Models view we render an aggregate KPI strip (total revenue,
 * spend, ROAS) plus per-platform follower totals — no individual influencer
 * sections (the operator picks one from the sidebar to drill down).
 */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  DollarSign,
  Layers,
  MessagesSquare,
  Receipt,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Topbar } from "@/components/dashboard/Topbar";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ModelOverview } from "@/components/dashboard/ModelOverview";
import { OnlyFansAttributionSection } from "@/components/dashboard/OnlyFansAttributionSection";
import { PlatformSection } from "@/components/dashboard/PlatformSection";
import { SubscribersROIChart } from "@/components/dashboard/SubscribersROIChart";
import { PlatformBadge } from "@/components/dashboard/PlatformBadge";
import { ShareLinkDialog } from "@/components/dashboard/ShareLinkDialog";
import { SubredditTable } from "@/components/subreddits/SubredditTable";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

import { useInfluencers } from "@/lib/influencers/influencers.hooks";
import { useEntries } from "@/lib/entries/entries.hooks";
import { useSubreddits } from "@/lib/subreddits/subreddits.hooks";
import { useSession } from "@/lib/auth/auth.hooks";
import { isEditorOrAdmin } from "@/lib/auth/roles";
import {
  ACQUISITION_PLATFORM_KEYS,
  PLATFORMS,
  type AcquisitionPlatformKey,
} from "@/lib/platforms/registry";
import {
  RANGE_LABELS,
  type DashboardRange,
} from "@/lib/utils/range";
import { exportElementToPdf, pdfFilename } from "@/lib/utils/pdf";
import { formatNumber, formatUSD, formatSignedInt } from "@/lib/utils/format";
import {
  crossPlatformAggregate,
  type CrossPlatformAggregate,
  type InfluencerEntries,
} from "@/lib/utils/derive";
import { lastNWeeks } from "@/lib/utils/week";

const Index = () => {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <DashboardContent />
      </Suspense>
    </AppShell>
  );
};

function DashboardContent() {
  const router = useRouter();
  const search = useSearchParams();
  const selectedId = search.get("id") ?? "all";
  const { toast } = useToast();

  const [range, setRange] = useState<DashboardRange>("30d");
  const [exporting, setExporting] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);

  const setSelectedId = (id: string) => {
    const params = new URLSearchParams(search.toString());
    if (id === "all") params.delete("id");
    else params.set("id", id);
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/", { scroll: false });
  };

  const influencersQ = useInfluencers();
  const influencers = influencersQ.data ?? [];

  const { data: session } = useSession();
  // Agency owners are read-only — they should see the same dashboard
  // sections as everyone else, but without the per-week edit controls.
  const readOnly = !isEditorOrAdmin(session?.role);

  const isAggregate = selectedId === "all";
  const selectedInfluencer = isAggregate
    ? null
    : influencers.find((i) => i._id === selectedId) ?? null;

  useEffect(() => {
    if (influencersQ.isError) {
      toast({
        title: "Failed to load influencers",
        description: (influencersQ.error as Error)?.message,
        variant: "destructive",
      });
    }
  }, [influencersQ.isError, influencersQ.error, toast]);

  const subtitle = isAggregate
    ? `${RANGE_LABELS[range]} · ${
        influencersQ.isLoading
          ? "loading…"
          : `${influencers.length} influencer${influencers.length === 1 ? "" : "s"} in your roster`
      }`
    : selectedInfluencer
      ? `${RANGE_LABELS[range]} · per-platform breakdown`
      : RANGE_LABELS[range];

  const title = isAggregate
    ? "All Models Overview"
    : selectedInfluencer?.name || "Loading…";

  const handleExportPdf = async () => {
    if (!captureRef.current) return;
    setExporting(true);
    try {
      await exportElementToPdf(captureRef.current, {
        filename: pdfFilename(
          isAggregate ? "all-models" : selectedInfluencer?.name ?? "dashboard",
          range,
        ),
      });
    } catch (err) {
      toast({
        title: "PDF export failed",
        description: (err as Error)?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      ref={captureRef}
      className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 animate-fade-in"
    >
      {/* Mobile influencer picker */}
      <div className="lg:hidden mb-4 flex items-center gap-2 overflow-x-auto scrollbar-thin pb-2 no-print">
        <button
          onClick={() => setSelectedId("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border ${
            selectedId === "all"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-secondary/50 text-muted-foreground border-border"
          }`}
        >
          All Models
        </button>
        {influencers.map((inf) => (
          <button
            key={inf._id}
            onClick={() => setSelectedId(inf._id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border ${
              selectedId === inf._id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary/50 text-muted-foreground border-border"
            }`}
          >
            {inf.name}
          </button>
        ))}
      </div>

      <Topbar
        title={title}
        subtitle={subtitle}
        range={range}
        onRangeChange={setRange}
        exporting={exporting}
        onExportPdf={handleExportPdf}
        onShare={
          influencers.length > 0 ? () => setShareDialogOpen(true) : undefined
        }
      />

      <ShareLinkDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        range={range}
        initialInfluencerId={selectedInfluencer?._id ?? null}
      />

      <div className="mb-6">
        <ModelOverview
          influencer={selectedInfluencer}
          isAggregate={isAggregate}
          totalCreators={influencers.length}
          isLoading={
            !isAggregate &&
            (influencersQ.isLoading ||
              (!selectedInfluencer && !influencersQ.isError))
          }
        />
      </div>

      {isAggregate ? (
        <AggregateOverview range={range} influencerIds={influencers.map((i) => i._id)} />
      ) : selectedInfluencer ? (
        <>
          <section className="mb-8">
            <PlatformBadge platform="onlyfans" />
            <OnlyFansAttributionSection
              influencer={selectedInfluencer}
              readOnly={readOnly}
            />
          </section>

          <section className="mb-8">
            <SubscribersROIChart influencer={selectedInfluencer} />
          </section>

          <section className="mb-8">
            <PlatformBadge platform="reddit" />
            <PlatformSection
              influencer={selectedInfluencer}
              platform="reddit"
              readOnly={readOnly}
            />
          </section>

          <section className="mb-8">
            <PlatformBadge platform="instagram" />
            <PlatformSection
              influencer={selectedInfluencer}
              platform="instagram"
              readOnly={readOnly}
            />
          </section>

          <section className="mb-8">
            <PlatformBadge platform="x" />
            <PlatformSection
              influencer={selectedInfluencer}
              platform="x"
              readOnly={readOnly}
            />
          </section>

          <section className="mb-8">
            <PlatformBadge platform="reddit" suffix="subreddits" />
            <InfluencerSubredditsSection influencerId={selectedInfluencer._id} />
          </section>
        </>
      ) : null}

      <footer className="text-center text-xs text-muted-foreground pt-4 pb-2">
        eLeopards Clients Dashboard · Manual entry · Internal use only
      </footer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  All-Models aggregate view                                                 */
/* -------------------------------------------------------------------------- */

const RANGE_TO_WEEKS: Record<DashboardRange, number> = {
  "7d": 1,
  "30d": 5,
  "90d": 13,
};

function AggregateOverview({
  range,
  influencerIds,
}: {
  range: DashboardRange;
  influencerIds: string[];
}) {
  const weekKeys = useMemo(() => lastNWeeks(RANGE_TO_WEEKS[range]), [range]);

  /* We hit the entries endpoint once with no influencer filter to get the
   * full slice for the window, then bucket per-influencer client-side.
   * That's one round trip regardless of how many influencers exist. */
  const entriesQ = useEntries({ weekKeys });

  const aggregate: CrossPlatformAggregate = useMemo(() => {
    const all = entriesQ.data ?? [];
    const byInf: Map<string, InfluencerEntries> = new Map();
    for (const id of influencerIds) {
      byInf.set(id, { influencerId: id, entries: [] });
    }
    for (const e of all) {
      const slot = byInf.get(e.influencerId);
      if (slot) slot.entries.push(e);
    }
    return crossPlatformAggregate(Array.from(byInf.values()), weekKeys);
  }, [entriesQ.data, influencerIds, weekKeys]);

  if (entriesQ.isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card-surface rounded-xl p-5 space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (entriesQ.isError) {
    return (
      <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive border border-destructive/30 text-sm mb-6">
        <AlertTriangle className="size-4 shrink-0 mt-0.5" />
        <div>
          <div className="font-medium">Couldn’t load aggregate data.</div>
          <div className="text-destructive/80 mt-0.5 text-xs">
            {(entriesQ.error as Error)?.message}
          </div>
        </div>
      </div>
    );
  }

  if (influencerIds.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-8 text-center">
        <div className="mx-auto size-12 rounded-full bg-secondary/60 grid place-items-center mb-3">
          <Users className="size-5 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold mb-1">
          No influencers in your roster
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Add an influencer from the Influencers page to start tracking
          weekly platform data.
        </p>
      </div>
    );
  }

  return (
    <>
      <section className="mb-8">
        <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="size-3" />
          OnlyFans roll-up
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard
            label="Total revenue"
            value={formatUSD(aggregate.totalRevenue, { fractional: true })}
            icon={DollarSign}
            accent="success"
            hint={`${aggregate.influencerCount} influencer${aggregate.influencerCount === 1 ? "" : "s"}`}
          />
          <KpiCard
            label="Total spend"
            value={formatUSD(aggregate.totalSpend, { fractional: true })}
            icon={Wallet}
            accent="info"
            hint="All sources"
          />
          <KpiCard
            label="Net"
            value={formatUSD(aggregate.net, { fractional: true })}
            icon={Receipt}
            accent={aggregate.net >= 0 ? "success" : "instagram"}
            hint={aggregate.net >= 0 ? "Profit" : "Loss"}
          />
          <KpiCard
            label="ROAS"
            value={
              aggregate.roas === null
                ? "—"
                : `${aggregate.roas.toFixed(2)}\u00d7`
            }
            icon={Target}
            accent="primary"
            hint={
              aggregate.roas === null
                ? "No spend in window"
                : "Revenue per $ spent"
            }
          />
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-1.5">
          <TrendingUp className="size-3" />
          Acquisition platforms · totals across roster
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ACQUISITION_PLATFORM_KEYS.map((src) => (
            <PlatformAggregateCard
              key={src}
              source={src}
              followers={aggregate.totalFollowers[src]}
              followerGrowth={aggregate.weeklyFollowerGrowth[src]}
            />
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-1.5">
          <MessagesSquare className="size-3" />
          Subreddits across roster
        </h3>
        <RosterSubredditsSection />
        <p className="mt-3 text-xs text-muted-foreground text-center">
          Pick an influencer from the sidebar to see their per-platform
          breakdown, charts, and weekly entry forms.
        </p>
      </section>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Subreddit sections                                                        */
/* -------------------------------------------------------------------------- */

function RosterSubredditsSection() {
  const subredditsQ = useSubreddits();

  if (subredditsQ.isLoading) {
    return (
      <div className="card-surface rounded-xl p-6 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (subredditsQ.isError) {
    return (
      <div className="card-surface rounded-xl p-6 text-sm text-destructive">
        Couldn't load subreddits: {(subredditsQ.error as Error).message}
      </div>
    );
  }

  return (
    <SubredditTable
      subreddits={subredditsQ.data ?? []}
      compact
      emptyMessage="No subreddits tracked yet. Add some on the Subreddits page."
    />
  );
}

function InfluencerSubredditsSection({ influencerId }: { influencerId: string }) {
  const subredditsQ = useSubreddits();

  if (subredditsQ.isLoading) {
    return (
      <div className="card-surface rounded-xl p-6 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (subredditsQ.isError) {
    return (
      <div className="card-surface rounded-xl p-6 text-sm text-destructive">
        Couldn't load subreddits: {(subredditsQ.error as Error).message}
      </div>
    );
  }

  return (
    <SubredditTable
      subreddits={subredditsQ.data ?? []}
      filterByInfluencerId={influencerId}
      compact
      emptyMessage="No subreddits linked to this model yet."
    />
  );
}

function PlatformAggregateCard({
  source,
  followers,
  followerGrowth,
}: {
  source: AcquisitionPlatformKey;
  followers: number;
  followerGrowth: number;
}) {
  const def = PLATFORMS[source];
  return (
    <div className="card-surface rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span
          className="size-7 rounded-md grid place-items-center text-white text-xs font-bold"
          style={{ background: def.color }}
        >
          {def.short}
        </span>
        <span className="text-sm font-semibold text-foreground">
          {def.label}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md bg-secondary/40 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Total followers
          </div>
          <div className="text-lg font-semibold text-foreground tabular-nums mt-0.5">
            {formatNumber(followers)}
          </div>
        </div>
        <div className="rounded-md bg-secondary/40 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Net Δ in window
          </div>
          <div
            className={`text-lg font-semibold tabular-nums mt-0.5 ${
              followerGrowth > 0
                ? "text-success"
                : followerGrowth < 0
                  ? "text-destructive"
                  : "text-foreground"
            }`}
          >
            {formatSignedInt(followerGrowth)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Index;
