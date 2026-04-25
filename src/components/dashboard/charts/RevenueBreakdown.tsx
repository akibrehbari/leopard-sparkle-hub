import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/data/selectors";

interface Props {
  subscription: number;
  tips: number;
  ppv: number;
}

export function RevenueBreakdown({ subscription, tips, ppv }: Props) {
  const data = [
    { name: "Subscriptions", value: subscription, color: "hsl(var(--primary))" },
    { name: "Tips", value: tips, color: "hsl(var(--success))" },
    { name: "PPV", value: ppv, color: "hsl(var(--info))" },
  ];
  const total = subscription + tips + ppv;

  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0">
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v: number, n) => [formatCurrency(v), n]}
            />
            <Pie
              data={data}
              dataKey="value"
              innerRadius={50}
              outerRadius={75}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</div>
          <div className="text-base font-bold text-foreground tabular-nums">{formatCurrency(total)}</div>
        </div>
      </div>
      <div className="flex-1 space-y-2.5">
        {data.map((d) => {
          const pct = total ? (d.value / total) * 100 : 0;
          return (
            <div key={d.name}>
              <div className="flex items-center justify-between text-xs mb-1">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full" style={{ background: d.color }} />
                  <span className="text-muted-foreground">{d.name}</span>
                </div>
                <div className="tabular-nums font-medium text-foreground">
                  {formatCurrency(d.value)} <span className="text-muted-foreground">· {pct.toFixed(0)}%</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: d.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}