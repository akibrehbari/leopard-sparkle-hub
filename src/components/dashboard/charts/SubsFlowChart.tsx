"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SubscriberFlowPoint } from "@/lib/utils/derive";

interface Props {
  data: SubscriberFlowPoint[];
}

/**
 * Daily new vs. recurring subscription transactions.
 *
 * Note: Infloww doesn't expose explicit churn/lost-sub events on the
 * transactions endpoint, so this is "what came in" not "net change".
 */
export function SubsFlowChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={data}
        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
      >
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
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
        />
        <Bar
          dataKey="newSubs"
          name="New"
          stackId="s"
          fill="hsl(var(--success))"
          radius={[3, 3, 0, 0]}
        />
        <Bar
          dataKey="renewals"
          name="Renewals"
          stackId="s"
          fill="hsl(var(--info))"
          radius={[0, 0, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
