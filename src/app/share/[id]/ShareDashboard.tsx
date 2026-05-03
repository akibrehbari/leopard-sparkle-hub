"use client";

/**
 * Read-only renderer for /share/[id].
 *
 * Mirrors `views/Index.tsx`'s 4-section layout (OnlyFans → Reddit → IG → X)
 * but consumes a server-prefetched `SharePayload`. The dashboard widgets
 * accept `prefetchedEntries` + `readOnly` so the page works without any
 * client-side data fetching, without auth, and without exposing the entry
 * forms.
 *
 * No sidebar — this view is built for external recipients with the URL.
 */

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ModelOverview } from "@/components/dashboard/ModelOverview";
import { OnlyFansAttributionSection } from "@/components/dashboard/OnlyFansAttributionSection";
import { PlatformBadge } from "@/components/dashboard/PlatformBadge";
import { PlatformSection } from "@/components/dashboard/PlatformSection";
import { cn } from "@/lib/utils";
import { exportElementToPdf, pdfFilename } from "@/lib/utils/pdf";
import {
  DASHBOARD_RANGES,
  type DashboardRange,
} from "@/lib/utils/range";
import type { SharePayload } from "@/lib/share/types";
import { pkt } from "@/lib/utils/dayjs";

interface Props {
  payload: SharePayload;
}

export function ShareDashboard({ payload }: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const range = payload.range;
  const { influencer, entries, platforms } = payload;

  const [exporting, setExporting] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);

  const setRange = (next: DashboardRange) => {
    const params = new URLSearchParams(search.toString());
    params.set("range", next);
    router.push(`/share/${influencer._id}?${params.toString()}`, {
      scroll: false,
    });
  };

  const handleExportPdf = async () => {
    if (!captureRef.current) return;
    setExporting(true);
    try {
      await exportElementToPdf(captureRef.current, {
        filename: pdfFilename(influencer.name, range),
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ShareTopbar
        title={influencer.name}
        subtitle="Read-only share · Live data, refreshed on each visit"
        range={range}
        onRangeChange={setRange}
        onExportPdf={handleExportPdf}
        exporting={exporting}
      />

      <div
        ref={captureRef}
        className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 animate-fade-in"
      >
        <div className="mb-6">
          <ModelOverview influencer={influencer} />
        </div>

        <section className="mb-8">
          <PlatformBadge platform="onlyfans" />
          <OnlyFansAttributionSection
            influencer={influencer}
            prefetchedEntries={entries.onlyfans ?? []}
            readOnly
          />
        </section>

        <section className="mb-8">
          <PlatformBadge platform="reddit" />
          <PlatformSection
            influencer={influencer}
            platform="reddit"
            prefetchedEntries={entries.reddit ?? []}
            prefetchedPlatform={platforms.reddit}
            readOnly
          />
        </section>

        <section className="mb-8">
          <PlatformBadge platform="instagram" />
          <PlatformSection
            influencer={influencer}
            platform="instagram"
            prefetchedEntries={entries.instagram ?? []}
            prefetchedPlatform={platforms.instagram}
            readOnly
          />
        </section>

        <section className="mb-8">
          <PlatformBadge platform="x" />
          <PlatformSection
            influencer={influencer}
            platform="x"
            prefetchedEntries={entries.x ?? []}
            prefetchedPlatform={platforms.x}
            readOnly
          />
        </section>

        <ShareFooter generatedAt={payload.generatedAt} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Local sub-components                                                      */
/* -------------------------------------------------------------------------- */

function ShareTopbar({
  title,
  subtitle,
  range,
  onRangeChange,
  onExportPdf,
  exporting,
}: {
  title: string;
  subtitle: string;
  range: DashboardRange;
  onRangeChange: (r: DashboardRange) => void;
  onExportPdf: () => void;
  exporting: boolean;
}) {
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-xl bg-primary/15 text-primary grid place-items-center shrink-0 no-print">
            <ShieldCheck className="size-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-semibold truncate">{title}</h1>
            <p className="text-[11px] text-muted-foreground truncate">
              {subtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 no-print">
          <div className="flex items-center rounded-lg bg-secondary/50 border border-border p-1">
            {DASHBOARD_RANGES.map((r) => (
              <button
                key={r}
                onClick={() => onRangeChange(r)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  range === r
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={onExportPdf}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {exporting ? "Exporting…" : "Export PDF"}
          </Button>
        </div>
      </div>
    </header>
  );
}

function ShareFooter({ generatedAt }: { generatedAt: string }) {
  // Use a fixed PKT format so server + client always agree on the string;
  // toLocaleString() resolves against the runtime's locale and would
  // hydration-mismatch when those differ (server en-US vs client en-GB).
  const when = pkt(generatedAt).format("MMM D, YYYY · h:mm A [PKT]");
  return (
    <footer className="text-center text-[11px] text-muted-foreground pt-6 pb-2 border-t border-border/60">
      <div>Read-only share · Live data, refreshed on each visit</div>
      <div className="mt-1 no-print">
        Page generated {when} ·{" "}
        <Link href="/login" className="hover:underline">
          Team sign-in
        </Link>
      </div>
    </footer>
  );
}
