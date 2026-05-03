"use client";

import { useRefunds } from "@/lib/infloww/infloww.hooks";
import { summarizeRefunds } from "@/lib/utils/derive";
import {
  formatUSD,
  formatNumber,
  inflowwAmount,
  parseInflowwTime,
} from "@/lib/infloww/util";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartCard } from "./ChartCard";
import { AlertTriangle, RotateCcw } from "lucide-react";
import type { InflowwRefund } from "@/lib/infloww/types";

interface Props {
  creatorId: string | null;
  startTime: string | number;
  endTime: string | number;
  /** When true, this is the aggregate "All Models" view; we don't fetch. */
  disabled?: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  done: "bg-destructive/15 text-destructive ring-1 ring-destructive/30",
  loading: "bg-warning/15 text-warning ring-1 ring-warning/30",
  undo: "bg-muted text-muted-foreground ring-1 ring-border",
};

const TYPE_LABEL: Record<string, string> = {
  tips: "Tips",
  post: "Post",
  chat_messages: "Messages",
  stream: "Stream",
  subscribes: "Subscription",
};

export function RefundsSection({ creatorId, startTime, endTime, disabled }: Props) {
  const { data, isLoading, isError, error } = useRefunds({
    creatorId: disabled ? null : creatorId,
    startTime,
    endTime,
    all: true,
  });

  const refunds: InflowwRefund[] = data?.data?.list ?? [];
  const summary = summarizeRefunds(refunds);

  return (
    <ChartCard
      title="Refunds & Chargebacks"
      subtitle="Reversed payments in this date range"
    >
      <div className="grid grid-cols-3 gap-2 mb-4">
        <MiniStat
          label="Refund count"
          value={isLoading ? "…" : formatNumber(summary.count)}
          accent="text-destructive"
          icon={<RotateCcw className="size-3.5" />}
        />
        <MiniStat
          label="Refund total"
          value={isLoading ? "…" : formatUSD(summary.totalAmount, { fractional: true })}
          accent="text-destructive"
        />
        <MiniStat
          label="Completed"
          value={isLoading ? "…" : formatNumber(summary.completed)}
        />
      </div>

      {isError ? (
        <ErrorBanner message={(error as Error)?.message ?? "Unknown error"} />
      ) : disabled ? (
        <EmptyHint message="Select a specific creator from the sidebar to view their refunds." />
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      ) : refunds.length === 0 ? (
        <EmptyHint message="No refunds in this range. Nice." />
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left py-2 px-2 font-medium">Date</th>
                <th className="text-left py-2 px-2 font-medium">Type</th>
                <th className="text-left py-2 px-2 font-medium">Status</th>
                <th className="text-right py-2 px-2 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {refunds.slice(0, 25).map((r) => {
                const time = parseInflowwTime(r.refundTime ?? r.paymentTime);
                return (
                  <tr key={r.id} className="hover:bg-secondary/30">
                    <td className="py-2 px-2 text-muted-foreground tabular-nums">
                      {time
                        ? time.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="py-2 px-2">
                      {TYPE_LABEL[r.transactionType] ?? r.transactionType}
                    </td>
                    <td className="py-2 px-2">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider ${
                          STATUS_STYLES[r.paymentStatus] ?? "text-muted-foreground"
                        }`}
                      >
                        {r.paymentStatus}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums font-medium text-destructive">
                      −{formatUSD(inflowwAmount(r.paymentAmount, "cents"), {
                        fractional: true,
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {refunds.length > 25 && (
            <div className="text-[11px] text-muted-foreground mt-3 text-center">
              Showing 25 of {refunds.length} refunds
            </div>
          )}
        </div>
      )}
    </ChartCard>
  );
}

function MiniStat({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-secondary/40 border border-border p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
        {icon}
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
        <div className="font-medium">Couldn’t load refunds</div>
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
