"use client";

import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string;
  delta?: number; // percent
  deltaSuffix?: string;
  icon: LucideIcon;
  accent?: "primary" | "success" | "info" | "instagram" | "reddit";
  hint?: string;
}

const accentMap: Record<NonNullable<Props["accent"]>, string> = {
  primary: "from-primary/20 to-primary/0 text-primary",
  success: "from-success/20 to-success/0 text-success",
  info: "from-info/20 to-info/0 text-info",
  instagram: "from-platform-instagram/20 to-platform-instagram/0 text-platform-instagram",
  reddit: "from-platform-reddit/20 to-platform-reddit/0 text-platform-reddit",
};

export function KpiCard({
  label,
  value,
  delta,
  deltaSuffix = "vs prev period",
  icon: Icon,
  accent = "primary",
  hint,
}: Props) {
  const positive = (delta ?? 0) >= 0;
  return (
    <div className="card-surface rounded-xl p-5 relative overflow-hidden group transition-all hover:shadow-elevated">
      <div
        className={cn(
          "absolute -top-12 -right-12 size-32 rounded-full bg-gradient-to-br blur-2xl opacity-60 transition-opacity group-hover:opacity-100",
          accentMap[accent]
        )}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground tabular-nums">
            {value}
          </div>
          {hint && (
            <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>
          )}
        </div>
        <div className={cn("size-9 rounded-lg grid place-items-center bg-secondary/60", accentMap[accent].split(" ").pop())}>
          <Icon className="size-4" />
        </div>
      </div>
      {delta !== undefined && (
        <div className="mt-4 flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-medium tabular-nums",
              positive ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
            )}
          >
            {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
          <span className="text-muted-foreground">{deltaSuffix}</span>
        </div>
      )}
    </div>
  );
}