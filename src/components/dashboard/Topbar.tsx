"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { DASHBOARD_RANGES, type DashboardRange } from "@/lib/utils/range";
import { Download, FileDown, Link2, Loader2 } from "lucide-react";
import { AgencyTopbarLinks } from "./AgencyTopbarLinks";
import { QuickAddButtons } from "./QuickAddButtons";

interface Props {
  title: string;
  subtitle: string;
  range: DashboardRange;
  onRangeChange: (r: DashboardRange) => void;
  /** Optional handlers for the Export dropdown. Items hide if their handler is missing. */
  onExportPdf?: () => void;
  onShare?: () => void;
  /** When true, the Export trigger swaps to a spinner while the PDF is generating. */
  exporting?: boolean;
  /**
   * When true: hides search bar + QuickAddButtons, shows the Infloww link,
   * and uses the 1w/4w/8w range set instead of the aggregate 2w/4w/8w set.
   */
  isIndividual?: boolean;
}

const RANGE_LABELS: Record<DashboardRange, string> = {
  "1w": "1w",
  "2w": "2w",
  "4w": "4w",
  "8w": "8w",
};

export function Topbar({
  title,
  subtitle,
  range,
  onRangeChange,
  onExportPdf,
  onShare,
  exporting,
  isIndividual,
}: Props) {
  const hasExportActions = Boolean(onExportPdf || onShare);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-2 no-print">
        {!isIndividual && <AgencyTopbarLinks />}
        {!isIndividual && <QuickAddButtons />}
        {isIndividual && (
          <a
            href="https://eleopards.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm" className="gap-2 font-semibold">
              Infloww
            </Button>
          </a>
        )}
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
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>

        {hasExportActions ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={exporting}
              >
                {exporting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                {exporting ? "Exporting…" : "Export"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {onExportPdf && (
                <DropdownMenuItem
                  onSelect={() => onExportPdf()}
                  disabled={exporting}
                >
                  <FileDown className="size-4" />
                  Export as PDF
                </DropdownMenuItem>
              )}
              {onExportPdf && onShare && <DropdownMenuSeparator />}
              {onShare && (
                <DropdownMenuItem onSelect={() => onShare()}>
                  <Link2 className="size-4" />
                  Copy share link
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="outline" size="sm" className="gap-2" disabled>
            <Download className="size-4" />
            Export
          </Button>
        )}
      </div>
    </div>
  );
}
