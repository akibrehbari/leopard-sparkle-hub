/**
 * Date-range helpers shared by the dashboard UI and the share page.
 *
 * Used purely for labeling and bounding the visible window — the underlying
 * weekly entries are pulled by ISO-week key, not by raw date, so these
 * helpers are about display rather than query slicing.
 */

export type DashboardRange = "7d" | "30d" | "90d";

export const DASHBOARD_RANGES: readonly DashboardRange[] = [
  "7d",
  "30d",
  "90d",
];

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
export function rangeToDates(
  range: DashboardRange,
  now: Date = new Date(),
): {
  start: Date;
  end: Date;
} {
  const end = new Date(now);
  const start = new Date(now);
  start.setDate(start.getDate() - RANGE_DAYS[range]);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}
