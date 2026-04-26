"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SubscriberFlowPoint } from "@/lib/infloww/derive";
import { formatNumber } from "@/lib/infloww/util";

interface Props {
  data: SubscriberFlowPoint[];
}

/**
 * Cumulative new + recurring subscriptions per day. The Infloww transaction
 * stream doesn't expose a churn signal, so this is a flow chart, not a
 * stock-of-active-subs chart.
 */
export function SubscriberChart({ data }: Props) {
  const points = data.map((d) => ({
    label: d.label,
    total: d.newSubs + d.renewals,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart
        data={points}
        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
      >
        <defs>
          <linearGradient id="grad-subs" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--info))" stopOpacity={0.45} />
            <stop offset="100%" stopColor="hsl(var(--info))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatNumber(Number(v))}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v: number) => [formatNumber(v), "Subscriptions"]}
        />
        <Area
          type="monotone"
          dataKey="total"
          stroke="hsl(var(--info))"
          strokeWidth={2}
          fill="url(#grad-subs)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
