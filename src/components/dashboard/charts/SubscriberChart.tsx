import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DailyPoint } from "@/data/types";
import { format, parseISO } from "date-fns";
import { formatNumber } from "@/data/selectors";

interface Props {
  data: DailyPoint[];
}

export function SubscriberChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="grad-subs" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--info))" stopOpacity={0.45} />
            <stop offset="100%" stopColor="hsl(var(--info))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(v) => format(parseISO(v), "MMM d")}
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
          labelFormatter={(v) => format(parseISO(String(v)), "MMM d, yyyy")}
          formatter={(v: number) => [formatNumber(v), "Subscribers"]}
        />
        <Area
          type="monotone"
          dataKey="subscribers"
          stroke="hsl(var(--info))"
          strokeWidth={2}
          fill="url(#grad-subs)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}