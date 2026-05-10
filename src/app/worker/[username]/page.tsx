"use client";

/**
 * Worker portal — /worker/[username]
 *
 * Workers see only their assigned influencers and the weekly tracker.
 * No financials, no notes, no reviews.
 */

import { useMemo, useState } from "react";
import { LogOut, TrendingUp } from "lucide-react";
import { useRouter, useParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformSection } from "@/components/dashboard/PlatformSection";
import { useToast } from "@/hooks/use-toast";

import { useSession, useLogout } from "@/lib/auth/auth.hooks";
import { useInfluencers } from "@/lib/influencers/influencers.hooks";
import { useEntries } from "@/lib/entries/entries.hooks";
import { PLATFORMS, type PlatformKey } from "@/lib/platforms/registry";
import { lastNWeeks } from "@/lib/utils/week";
import type { Influencer } from "@/lib/influencers/types";

const HISTORY_WEEKS = 12;
const PLATFORM_ORDER: PlatformKey[] = ["reddit", "instagram", "x", "onlyfans"];
const HANDLE_PREFIX: Record<string, string> = {
  reddit: "u/",
  instagram: "@",
  x: "@",
  onlyfans: "@",
};

export default function WorkerPortal() {
  const params = useParams<{ username: string }>();
  const { data: session, isLoading: sessionLoading } = useSession();
  const logout = useLogout();
  const router = useRouter();
  const { toast } = useToast();

  const { data: influencers, isLoading: infLoading } = useInfluencers({
    enabled: session?.role === "worker",
  });

  const urlUsername = params?.username ?? "";
  if (!sessionLoading && session?.role === "worker" && session.username !== urlUsername) {
    router.replace(`/worker/${session.username}`);
  }

  const weekKeys = useMemo(() => lastNWeeks(HISTORY_WEEKS), []);
  const [selectedInfluencer, setSelectedInfluencer] = useState<Influencer | null>(null);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => router.replace("/login"),
      onError: () => toast({ title: "Logout failed", variant: "destructive" }),
    });
  };

  if (sessionLoading || infLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!session || session.role !== "worker") return null;

  const list = influencers ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-gradient-primary grid place-items-center shadow-glow shrink-0">
            <span className="text-primary-foreground text-xs font-bold">
              {(session.username[0] ?? "W").toUpperCase()}
            </span>
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">{session.username}</div>
            <div className="text-[10px] text-muted-foreground">Data entry · Cuhvet</div>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={handleLogout}>
          <LogOut className="size-3.5" />
          Sign out
        </Button>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {list.length === 0 ? (
          <div className="card-surface rounded-xl p-12 text-center text-sm text-muted-foreground">
            No influencers assigned to you yet. Ask the admin.
          </div>
        ) : selectedInfluencer ? (
          <InfluencerDetail
            influencer={selectedInfluencer}
            weekKeys={weekKeys}
            onBack={() => setSelectedInfluencer(null)}
          />
        ) : (
          <div className="space-y-4">
            <h1 className="text-lg font-semibold text-foreground">Your influencers</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {list.map((inf) => (
                <button
                  key={inf._id}
                  onClick={() => setSelectedInfluencer(inf)}
                  className="card-surface rounded-xl p-4 text-left hover:bg-secondary/40 transition-colors space-y-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-gradient-primary grid place-items-center shrink-0">
                      <span className="text-primary-foreground font-bold">
                        {(inf.name[0] ?? "?").toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-foreground">{inf.name}</div>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {PLATFORM_ORDER.filter((p) => inf.handles[p]).map((p) => (
                          <span
                            key={p}
                            className="size-2 rounded-full inline-block"
                            style={{ background: PLATFORMS[p].color }}
                            title={PLATFORMS[p].label}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {PLATFORM_ORDER.filter((p) => inf.handles[p]).map((p) => (
                      <span key={p} className="mr-2">
                        {HANDLE_PREFIX[p]}{inf.handles[p]}
                      </span>
                    ))}
                  </div>
                  {inf.trackerNotes && (
                    <p className="text-[11px] text-muted-foreground border-t border-border pt-2 mt-1 line-clamp-2">
                      {inf.trackerNotes}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function InfluencerDetail({
  influencer,
  weekKeys,
  onBack,
}: {
  influencer: Influencer;
  weekKeys: string[];
  onBack: () => void;
}) {
  const entriesQ = useEntries({ influencerId: influencer._id, weekKeys });
  const allEntries = entriesQ.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Back
        </Button>
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-gradient-primary grid place-items-center shrink-0">
            <span className="text-primary-foreground font-bold text-sm">
              {(influencer.name[0] ?? "?").toUpperCase()}
            </span>
          </div>
          <div>
            <div className="font-semibold text-foreground">{influencer.name}</div>
            <div className="text-[11px] text-muted-foreground flex gap-2">
              {PLATFORM_ORDER.filter((p) => influencer.handles[p]).map((p) => (
                <span key={p}>{HANDLE_PREFIX[p]}{influencer.handles[p]}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <TrendingUp className="size-3" />
          Weekly tracker
        </h2>
        <div className="space-y-4">
          {PLATFORM_ORDER.map((platform) => {
            const platformEntries = allEntries.filter((e) => e.platform === platform);
            return (
              <PlatformSection
                key={platform}
                influencer={influencer}
                platform={platform}
                prefetchedEntries={platformEntries}
                hideFinancials
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
