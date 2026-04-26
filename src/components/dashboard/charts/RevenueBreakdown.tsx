"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ChannelBreakdownPoint, RevenueChannel } from "@/lib/infloww/derive";
import { formatUSD } from "@/lib/infloww/util";

interface Props {
  channels: ChannelBreakdownPoint[];
}

const CHANNEL_COLORS: Record<RevenueChannel, string> = {
  Subscriptions: "hsl(var(--primary))",
  Tips: "hsl(var(--success))",
  Messages: "hsl(var(--info))",
  Posts: "hsl(var(--warning))",
  Streams: "hsl(var(--platform-instagram))",
  Referrals: "hsl(var(--platform-reddit))",
  Other: "hsl(var(--muted-foreground))",
};

export function RevenueBreakdown({ channels }: Props) {
  const total = channels.reduce((s, c) => s + c.net, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-[160px] text-xs text-muted-foreground">
        No revenue in this range yet.
      </div>
    );
  }

  const data = channels.map((c) => ({
    name: c.channel,
    value: c.net,
    color: CHANNEL_COLORS[c.channel],
    share: c.share,
  }));

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
              formatter={(v: number, n) => [formatUSD(v, { fractional: true }), n]}
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
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Total
          </div>
          <div className="text-base font-bold text-foreground tabular-nums">
            {formatUSD(total)}
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-2.5">
        {data.map((d) => {
          const pct = total ? (d.value / total) * 100 : 0;
          return (
            <div key={d.name}>
              <div className="flex items-center justify-between text-xs mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: d.color }}
                  />
                  <span className="text-muted-foreground">{d.name}</span>
                </div>
                <div className="tabular-nums font-medium text-foreground">
                  {formatUSD(d.value)}{" "}
                  <span className="text-muted-foreground">
                    · {pct.toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: d.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
