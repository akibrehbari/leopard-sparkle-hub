"use client";

/**
 * Influencer personal portal — /influencer/[username]
 *
 * Shows stats and team reviews only. NO financial data (no revenue, spend,
 * ROI, ROAS) — these are stripped at the API layer for influencer sessions.
 */

import { useMemo } from "react";
import { LogOut, TrendingUp, MessageSquare, Users } from "lucide-react";
import { useRouter, useParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformSection } from "@/components/dashboard/PlatformSection";
import { KpiCard } from "@/components/dashboard/KpiCard";

import { useSession, useLogout } from "@/lib/auth/auth.hooks";
import { useInfluencers } from "@/lib/influencers/influencers.hooks";
import { useEntries } from "@/lib/entries/entries.hooks";
import { useReviews } from "@/lib/influencers/reviews.hooks";
import { PLATFORMS } from "@/lib/platforms/registry";
import { lastNWeeks, weekShortLabel } from "@/lib/utils/week";
import { formatNumber } from "@/lib/utils/format";

const HISTORY_WEEKS = 12;

export default function InfluencerPortal() {
  const params = useParams<{ username: string }>();
  const { data: session, isLoading: sessionLoading } = useSession();
  const logout = useLogout();
  const router = useRouter();

  const { data: influencers, isLoading: infLoading } = useInfluencers({
    enabled: session?.role === "influencer",
  });

  const influencer = influencers?.[0] ?? null;

  const urlUsername = params?.username ?? "";
  if (
    !sessionLoading &&
    session?.role === "influencer" &&
    session.username !== urlUsername
  ) {
    router.replace(`/influencer/${session.username}`);
  }

  const weekKeys = useMemo(() => lastNWeeks(HISTORY_WEEKS), []);

  const entriesQ = useEntries({ weekKeys }, { enabled: !!influencer });
  const allEntries = entriesQ.data ?? [];

  const reviewsQ = useReviews(influencer?._id ?? null, { enabled: !!influencer });
  const reviews = reviewsQ.data ?? [];

  const ofEntries = useMemo(
    () => allEntries.filter((e) => e.platform === "onlyfans"),
    [allEntries],
  );

  const latestSubscribers = useMemo(() => {
    const sorted = ofEntries
      .filter((e) => typeof e.data?.subscribers === "number")
      .sort((a, b) => b.weekKey.localeCompare(a.weekKey));
    return sorted[0]?.data?.subscribers ?? null;
  }, [ofEntries]);

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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
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
                    <span className="size-2 rounded-full" style={{ background: PLATFORMS[p].color }} />
                    {HANDLE_PREFIX[p]}{handle}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* OnlyFans subscribers (no revenue) */}
        {latestSubscribers !== null && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Users className="size-3" />
              OnlyFans
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <KpiCard
                label="Total subscribers"
                value={formatNumber(latestSubscribers)}
                icon={Users}
                accent="primary"
                hint="Latest recorded total"
              />
            </div>
          </section>
        )}

        {/* Platform stats — read-only */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <TrendingUp className="size-3" />
            Platform stats
          </h2>
          <div className="space-y-4">
            {(["reddit", "instagram", "x"] as const).map((platform) => {
              if (!influencer.handles[platform]) return null;
              const platformEntries = allEntries.filter((e) => e.platform === platform);
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

        {/* Reviews from the team */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <MessageSquare className="size-3" />
            Reviews from the team
          </h2>
          {reviewsQ.isLoading ? (
            <div className="space-y-3">
              {[0, 1].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            </div>
          ) : reviews.length === 0 ? (
            <div className="card-surface rounded-xl p-6 text-center text-xs text-muted-foreground border border-dashed border-border">
              No reviews yet. Your team will post feedback here.
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((r) => (
                <div key={r._id} className="card-surface rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-full bg-gradient-primary grid place-items-center shrink-0">
                        <span className="text-primary-foreground text-[10px] font-bold">
                          {(r.authorName[0] ?? "?").toUpperCase()}
                        </span>
                      </div>
                      <span className="text-xs font-medium">{r.authorName}</span>
                      {r.weekKey && (
                        <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                          {weekShortLabel(r.weekKey)}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </span>
                  </div>
                  {r.rating != null && (
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} className={`text-sm ${i < r.rating! ? "text-yellow-400" : "text-muted-foreground/30"}`}>★</span>
                      ))}
                    </div>
                  )}
                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{r.content}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
