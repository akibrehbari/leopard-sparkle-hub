import type { ModelProfile } from "@/data/types";
import { ChartCard } from "./ChartCard";
import { DollarSign, TrendingDown, TrendingUp, Users, Clock } from "lucide-react";

interface Props {
  model: ModelProfile;
}

function EconCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "text-foreground",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <div className={`text-xl font-bold tabular-nums ${accent}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

export function SubscriptionEconomicsSection({ model }: Props) {
  const s = model.subscriptionEconomics;
  const margin = s.revenuePerSub - s.costPerSub;
  const marginPct = s.costPerSub > 0 ? (margin / s.costPerSub) * 100 : 0;
  const ltvCacRatio = s.costPerSub > 0 ? s.lifetimeValue / s.costPerSub : 0;
  const healthy = ltvCacRatio >= 3;

  return (
    <ChartCard
      title="Per-Subscriber Economics"
      subtitle="Unit economics: what each subscriber costs and earns"
    >
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <EconCard
          label="Price / sub"
          value={`$${s.pricePerSub.toFixed(2)}`}
          hint="Avg monthly subscription"
          icon={DollarSign}
          accent="text-foreground"
        />
        <EconCard
          label="Cost / sub (CAC)"
          value={`$${s.costPerSub.toFixed(2)}`}
          hint="Acquisition + content"
          icon={TrendingDown}
          accent="text-destructive"
        />
        <EconCard
          label="Revenue / sub"
          value={`$${s.revenuePerSub.toFixed(2)}`}
          hint="Subs + tips + PPV"
          icon={TrendingUp}
          accent="text-success"
        />
        <EconCard
          label="Lifetime value"
          value={`$${s.lifetimeValue.toFixed(0)}`}
          hint={`LTV / CAC ${ltvCacRatio.toFixed(1)}×`}
          icon={Users}
          accent="text-info"
        />
        <EconCard
          label="Payback"
          value={s.paybackDays > 0 ? `${Math.round(s.paybackDays)}d` : "—"}
          hint="Days to recoup CAC"
          icon={Clock}
          accent="text-foreground"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Net margin / sub</span>
            <span
              className={`text-sm font-bold tabular-nums ${
                margin >= 0 ? "text-success" : "text-destructive"
              }`}
            >
              {margin >= 0 ? "+" : ""}${margin.toFixed(2)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className={`h-full ${margin >= 0 ? "bg-success" : "bg-destructive"}`}
              style={{ width: `${Math.min(Math.abs(marginPct), 100)}%` }}
            />
          </div>
          <div className="text-[11px] text-muted-foreground mt-2">
            {marginPct >= 0 ? "+" : ""}
            {marginPct.toFixed(0)}% margin over acquisition cost
          </div>
        </div>

        <div
          className={`rounded-lg p-4 border ${
            healthy
              ? "border-success/40 bg-success/10"
              : "border-destructive/40 bg-destructive/10"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Health signal</span>
            <span
              className={`text-xs font-bold ${
                healthy ? "text-success" : "text-destructive"
              }`}
            >
              {healthy ? "HEALTHY" : "ATTENTION"}
            </span>
          </div>
          <div className="text-sm font-semibold text-foreground">
            LTV/CAC ratio · {ltvCacRatio.toFixed(2)}×
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {healthy
              ? "Above the 3× benchmark — acquisition spend is profitable."
              : "Below the 3× benchmark — review acquisition cost or pricing."}
          </div>
        </div>
      </div>
    </ChartCard>
  );
}