import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DailyPoint } from "@/data/types";
import { format, parseISO } from "date-fns";

interface Props {
  data: DailyPoint[];
}

export function SubsFlowChart({ data }: Props) {
  const transformed = data.map((d) => ({ ...d, lostSubs: -d.lostSubs }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={transformed} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} stackOffset="sign">
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
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(v) => format(parseISO(String(v)), "MMM d, yyyy")}
          formatter={(v: number, n) => [Math.abs(v), n]}
        />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        <Bar dataKey="newSubs" name="New" stackId="s" fill="hsl(var(--success))" radius={[3, 3, 0, 0]} />
        <Bar dataKey="lostSubs" name="Lost" stackId="s" fill="hsl(var(--destructive))" radius={[0, 0, 3, 3]} />
      </BarChart>
    </ResponsiveContainer>
  );
}