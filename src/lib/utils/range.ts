/**
 * Date-range helpers shared by the dashboard UI and the share page.
 *
 * Used purely for labeling and bounding the visible window — the underlying
 * weekly entries are pulled by ISO-week key, not by raw date, so these
 * helpers are about display rather than query slicing.
 */

export type DashboardRange = "2w" | "4w" | "8w";

export const DASHBOARD_RANGES: readonly DashboardRange[] = [
  "2w",
  "4w",
  "8w",
];

export const RANGE_LABELS: Record<DashboardRange, string> = {
  "2w": "Last 2 weeks",
  "4w": "Last 4 weeks",
  "8w": "Last 8 weeks",
};

export const RANGE_DAYS: Record<DashboardRange, number> = {
  "2w": 14,
  "4w": 28,
  "8w": 56,
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
