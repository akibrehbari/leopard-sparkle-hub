"use client";

import { useState } from "react";
import { useLinks } from "@/lib/infloww/hooks";
import { summarizeLinks } from "@/lib/infloww/derive";
import {
  formatUSD,
  formatNumber,
  inflowwAmount,
  parseInflowwTime,
} from "@/lib/infloww/util";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartCard } from "./ChartCard";
import { AlertTriangle, Link2, Megaphone, Gift } from "lucide-react";
import type {
  InflowwCampaignLink,
  InflowwLink,
  InflowwLinkType,
  InflowwTrackingLink,
  InflowwTrialLink,
} from "@/lib/infloww/types";
import { cn } from "@/lib/utils";

interface Props {
  creatorId: string | null;
  startTime: string | number;
  endTime: string | number;
  /** When true, this is the aggregate "All Models" view; we don't fetch. */
  disabled?: boolean;
}

const LINK_TABS: { id: InflowwLinkType; label: string; icon: React.ReactNode }[] = [
  { id: "TRIAL", label: "Free Trials", icon: <Gift className="size-3.5" /> },
  { id: "CAMPAIGN", label: "Promotions", icon: <Megaphone className="size-3.5" /> },
  { id: "TRACKING", label: "Tracking", icon: <Link2 className="size-3.5" /> },
];

export function LinksSection({ creatorId, startTime, endTime, disabled }: Props) {
  const [linkType, setLinkType] = useState<InflowwLinkType>("TRIAL");
  const { data, isLoading, isError, error } = useLinks({
    creatorId: disabled ? null : creatorId,
    linkType,
    startTime,
    endTime,
    limit: 50,
  });

  const links: InflowwLink[] = data?.data?.list ?? [];
  const summary = summarizeLinks(links);

  return (
    <ChartCard
      title="Marketing Links"
      subtitle="Promotions, free trials, and tracking link performance"
    >
      <div className="flex items-center gap-1 mb-4 p-1 rounded-lg bg-secondary/50 border border-border w-fit">
        {LINK_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setLinkType(tab.id)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              linkType === tab.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <MiniStat
          label="Active links"
          value={isLoading ? "…" : formatNumber(summary.totalLinks)}
        />
        <MiniStat
          label="Subscribers"
          value={isLoading ? "…" : formatNumber(summary.totalSubs)}
          accent="text-info"
        />
        <MiniStat
          label="Net earnings"
          value={isLoading ? "…" : formatUSD(summary.totalEarningsNet)}
          accent="text-success"
        />
      </div>

      {isError ? (
        <ErrorBanner message={(error as Error)?.message ?? "Unknown error"} />
      ) : disabled ? (
        <EmptyHint message="Select a specific creator from the sidebar to view their marketing links." />
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : links.length === 0 ? (
        <EmptyHint
          message={`No ${linkType.toLowerCase()} links in this range.`}
        />
      ) : (
        <div className="space-y-2">
          {links.slice(0, 10).map((link) => (
            <LinkRow key={link.id} link={link} />
          ))}
          {links.length > 10 && (
            <div className="text-[11px] text-muted-foreground mt-2 text-center">
              Showing 10 of {links.length} {linkType.toLowerCase()} links
            </div>
          )}
        </div>
      )}
    </ChartCard>
  );
}

function LinkRow({ link }: { link: InflowwLink }) {
  const created = parseInflowwTime(link.createdTime);
  const isCampaign = link.linkKind === "CAMPAIGN";
  const isTrial = link.linkKind === "TRIAL";
  const isTracking = link.linkKind === "TRACKING";

  const title = isCampaign
    ? (link as InflowwCampaignLink).message || `Campaign ${link.id}`
    : (link as InflowwTrialLink | InflowwTrackingLink).name || `Link ${link.id}`;

  // Live API returns numeric link fields as strings; coerce safely.
  const subCount = "subCount" in link ? Number(link.subCount ?? 0) : 0;

  return (
    <div className="rounded-lg bg-secondary/30 border border-border p-3 hover:bg-secondary/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-medium text-sm text-foreground truncate">
              {title}
            </div>
            {link.finishedFlag && (
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                Ended
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
            {created && (
              <span>
                {created.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
            {isCampaign && (
              <>
                <span>{(link as InflowwCampaignLink).discount}% off</span>
                <span>{(link as InflowwCampaignLink).subDuration}d duration</span>
              </>
            )}
            {isTrial && (
              <span>
                {(link as InflowwTrialLink).subDuration}d free trial
              </span>
            )}
            {isTracking && (
              <span>
                {formatNumber(Number((link as InflowwTrackingLink).clickCount ?? 0))} clicks
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold tabular-nums text-success">
            {formatUSD(inflowwAmount(link.earningsNet, "cents"))}
          </div>
          <div className="text-[11px] text-muted-foreground tabular-nums">
            {formatNumber(subCount)} sub{subCount === 1 ? "" : "s"}
          </div>
        </div>
      </div>
      {isTracking && (
        <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-border/60 text-[11px]">
          <div>
            <span className="text-muted-foreground">Sub CVR: </span>
            <span className="tabular-nums text-foreground">
              {Number((link as InflowwTrackingLink).subscriptionCVR ?? 0).toFixed(1)}%
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Spend CVR: </span>
            <span className="tabular-nums text-foreground">
              {Number((link as InflowwTrackingLink).spendingCVR ?? 0).toFixed(1)}%
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">EPC net: </span>
            <span className="tabular-nums text-foreground">
              {formatUSD(
                inflowwAmount((link as InflowwTrackingLink).epcNet, "cents"),
                { fractional: true },
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg bg-secondary/40 border border-border p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`text-lg font-bold tabular-nums mt-1 ${accent ?? "text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive border border-destructive/30 text-xs">
      <AlertTriangle className="size-4 shrink-0 mt-0.5" />
      <div>
        <div className="font-medium">Couldn’t load links</div>
        <div className="text-destructive/80 mt-0.5">{message}</div>
      </div>
    </div>
  );
}

function EmptyHint({ message }: { message: string }) {
  return (
    <div className="text-xs text-muted-foreground p-4 rounded-lg bg-secondary/30 border border-dashed border-border text-center">
      {message}
    </div>
  );
}
