/**
 * Date-range helpers shared by the dashboard UI and Infloww query layer.
 *
 * Why milliseconds (not ISO)? The Infloww API accepts both, but unix-ms is
 * unambiguous about timezones (everything is UTC). Sending the millis avoids
 * day-boundary surprises from local timezone parsing.
 */

export type DashboardRange = "7d" | "30d" | "90d";

export const DASHBOARD_RANGES: DashboardRange[] = ["7d", "30d", "90d"];

export const RANGE_LABELS: Record<DashboardRange, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
};

export const RANGE_DAYS: Record<DashboardRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

/** Resolve a relative range to absolute Date bounds. */
export function rangeToDates(range: DashboardRange, now: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const end = new Date(now);
  const start = new Date(now);
  start.setDate(start.getDate() - RANGE_DAYS[range]);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

/** Same as rangeToDates but returns unix-ms strings (the API's preferred format). */
export function rangeToQueryParams(
  range: DashboardRange,
  now: Date = new Date(),
): { startTime: string; endTime: string } {
  const { start, end } = rangeToDates(range, now);
  return {
    startTime: String(start.getTime()),
    endTime: String(end.getTime()),
  };
}
