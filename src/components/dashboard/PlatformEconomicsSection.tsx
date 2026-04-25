import type { ModelProfile } from "@/data/types";
import { formatCurrency } from "@/data/selectors";
import { ChartCard } from "./ChartCard";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Props {
  model: ModelProfile;
}

const PLATFORMS = [
  { key: "reddit", label: "Reddit", color: "hsl(var(--reddit))" },
  { key: "twitter", label: "X", color: "hsl(var(--twitter))" },
  { key: "instagram", label: "Instagram", color: "hsl(var(--instagram))" },
  { key: "telegram", label: "Telegram", color: "hsl(var(--telegram))" },
] as const;

export function PlatformEconomicsSection({ model }: Props) {
  const econ = model.platformEconomics;
  const data = PLATFORMS.map((p) => {
    const e = econ[p.key];
    const profit = e.revenue - e.cost;
    const roi = e.cost > 0 ? (profit / e.cost) * 100 : 0;
    return {
      platform: p.label,
      color: p.color,
      cost: e.cost,
      revenue: e.revenue,
      profit,
      roi,
    };
  });

  const totalCost = data.reduce((s, d) => s + d.cost, 0);
  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const totalProfit = totalRevenue - totalCost;
  const blendedRoi = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <ChartCard
        title="Cost vs Revenue per Platform"
        subtitle="Operational spend against attributed OF revenue"
        className="xl:col-span-2"
      >
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="platform" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatCurrency(Number(v))}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--secondary) / 0.4)" }}
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number) => formatCurrency(value)}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }} />
            <Bar dataKey="cost" name="Cost" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="ROI per Platform" subtitle="Profit and return on spend">
        <div className="space-y-3">
          {data.map((d) => (
            <div key={d.platform} className="rounded-lg border border-border bg-secondary/30 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: d.color }} />
                  <span className="text-sm font-semibold text-foreground">{d.platform}</span>
                </div>
                <span
                  className={`text-xs font-bold tabular-nums ${
                    d.roi >= 0 ? "text-success" : "text-destructive"
                  }`}
                >
                  {d.roi >= 0 ? "+" : ""}
                  {d.roi.toFixed(0)}% ROI
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <div className="text-muted-foreground">Cost</div>
                  <div className="font-semibold text-foreground tabular-nums">{formatCurrency(d.cost)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Revenue</div>
                  <div className="font-semibold text-foreground tabular-nums">{formatCurrency(d.revenue)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Profit</div>
                  <div
                    className={`font-semibold tabular-nums ${
                      d.profit >= 0 ? "text-success" : "text-destructive"
                    }`}
                  >
                    {formatCurrency(d.profit)}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div className="rounded-lg bg-primary/10 border border-primary/30 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Blended</span>
              <span
                className={`text-sm font-bold tabular-nums ${
                  blendedRoi >= 0 ? "text-success" : "text-destructive"
                }`}
              >
                {blendedRoi >= 0 ? "+" : ""}
                {blendedRoi.toFixed(0)}% ROI
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {formatCurrency(totalCost)} spent → {formatCurrency(totalRevenue)} earned ·
              <span className={totalProfit >= 0 ? "text-success" : "text-destructive"}>
                {" "}{formatCurrency(totalProfit)} profit
              </span>
            </div>
          </div>
        </div>
      </ChartCard>
    </div>
  );
}