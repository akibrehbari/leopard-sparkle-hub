"use client";

import type { Influencer } from "@/lib/influencers/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers } from "lucide-react";
import { pkt } from "@/lib/utils/dayjs";
import {
  PLATFORMS,
  PLATFORM_KEYS,
  type PlatformKey,
} from "@/lib/platforms/registry";

interface Props {
  influencer: Influencer | null;
  /** When true, renders the "all models" aggregate header. */
  isAggregate?: boolean;
  totalCreators?: number;
  isLoading?: boolean;
}

const HANDLE_PREFIX: Record<PlatformKey, string> = {
  reddit: "u/",
  instagram: "@",
  x: "@",
  onlyfans: "@",
};

export function ModelOverview({
  influencer,
  isAggregate,
  totalCreators,
  isLoading,
}: Props) {
  if (isLoading) {
    return (
      <div className="card-surface rounded-xl p-5 flex items-center gap-5 relative overflow-hidden">
        <Skeleton className="size-16 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-7 w-24 mt-2" />
        </div>
      </div>
    );
  }

  if (isAggregate) {
    return (
      <div className="card-surface rounded-xl p-5 flex items-center gap-5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-primary opacity-[0.06] pointer-events-none" />
        <div className="size-16 rounded-2xl bg-gradient-primary grid place-items-center shadow-glow shrink-0">
          <Layers className="size-7 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0 relative">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-foreground truncate">
              All Models
            </h2>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-success/15 text-success ring-1 ring-success/30">
              Aggregated
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {totalCreators ?? 0} influencer
            {totalCreators === 1 ? "" : "s"} in your roster
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-gradient-primary tabular-nums">
              {totalCreators ?? 0}
            </span>
            <span className="text-xs text-muted-foreground">influencers</span>
          </div>
        </div>
      </div>
    );
  }

  if (!influencer) return null;

  const display = influencer.name || "Untitled";
  const handlesByPlatform = PLATFORM_KEYS.flatMap<{
    platform: PlatformKey;
    handle: string;
  }>((key) => {
    const handle = influencer.handles[key];
    return handle ? [{ platform: key, handle }] : [];
  });

  return (
    <div className="card-surface rounded-xl p-5 flex items-center gap-5 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-primary opacity-[0.06] pointer-events-none" />
      <div className="size-16 rounded-2xl bg-gradient-primary grid place-items-center shadow-glow shrink-0 ring-2 ring-primary/30">
        <span className="text-primary-foreground text-xl font-bold">
          {(display[0] ?? "?").toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0 relative">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-xl font-bold text-foreground truncate">{display}</h2>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {handlesByPlatform.length === 0 && (
            <span className="text-muted-foreground/70 italic">
              No handles set yet
            </span>
          )}
          {handlesByPlatform.map(({ platform, handle }) => (
            <span key={platform} className="inline-flex items-center gap-1">
              <span
                className="size-2 rounded-full"
                style={{ background: PLATFORMS[platform].color }}
              />
              <span className="text-foreground/80">
                {HANDLE_PREFIX[platform]}
                {handle}
              </span>
            </span>
          ))}
          <span className="text-muted-foreground/60">
            Added {pkt(influencer.createdAt).format("MMM D, YYYY")}
          </span>
        </div>
      </div>
    </div>
  );
}
