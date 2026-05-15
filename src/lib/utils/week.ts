/**
 * ISO-week helpers anchored to PKT (Asia/Karachi, UTC+5, no DST).
 *
 * Every operation runs through dayjs with the `Asia/Karachi` timezone, so
 * "the week ending Sunday" matches what the team actually sees during their
 * Sunday data-entry session, regardless of where the server runs.
 *
 * Week key format: "YYYY-Www" e.g. "2026-W18".
 */

import { pkt } from "./dayjs";
import type { ConfigType } from "dayjs";

export function toWeekKey(d: ConfigType = new Date()): string {
  const m = pkt(d);
  return `${m.isoWeekYear()}-W${String(m.isoWeek()).padStart(2, "0")}`;
}

export function parseWeekKey(key: string): { year: number; week: number } | null {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(key);
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > 53) return null;
  return { year, week };
}

/**
 * Monday 00:00 PKT (start) and Sunday 23:59:59.999 PKT (end) for a week key.
 * Returned as native Date instants so they can be stored in Mongo and
 * compared with other UTC-anchored Dates.
 */
export function weekRange(key: string): { start: Date; end: Date } | null {
  const parts = parseWeekKey(key);
  if (!parts) return null;
  // Jan 4 is always in ISO week 1 of its ISO year. Anchor on it, snap to the
  // start of week 1, then add (week-1) weeks.
  const jan4 = pkt(`${parts.year}-01-04`);
  const week1Start = jan4.startOf("isoWeek");
  const start = week1Start.add(parts.week - 1, "week");
  const end = start.endOf("isoWeek");
  return { start: start.toDate(), end: end.toDate() };
}

export function currentWeekKey(): string {
  return toWeekKey(new Date());
}

/**
 * Returns true when today (PKT) is Sunday — the day the team logs weekly data.
 * The current week is only shown in the UI on Sunday; mid-week it stays hidden.
 */
export function isTodaySundayPKT(now: ConfigType = new Date()): boolean {
  return pkt(now).isoWeekday() === 7; // ISO 7 = Sunday
}

/**
 * Last N weeks ending with the most recent *displayable* week, oldest-first.
 *
 * "Displayable" means the week has ended (i.e. it is Sunday in PKT or later).
 * Monday–Saturday the current incomplete week is excluded; on Sunday it is
 * included so the team can log and immediately see it in the UI.
 *
 * E.g. lastNWeeks(3) on a Wednesday in 2026-W18:
 *   → ["2026-W15", "2026-W16", "2026-W17"]  (W18 not shown yet)
 * On Sunday in 2026-W18:
 *   → ["2026-W16", "2026-W17", "2026-W18"]  (W18 now visible)
 */
export function lastNWeeks(n: number, from: ConfigType = new Date()): string[] {
  const out: string[] = [];
  const base = pkt(from);
  // If today is not Sunday, anchor to last week so the current incomplete week
  // is excluded. On Sunday the current week is the "completed" week.
  const anchor = isTodaySundayPKT(from) ? base : base.subtract(1, "week");
  for (let i = n - 1; i >= 0; i -= 1) {
    out.push(toWeekKey(anchor.subtract(i, "week")));
  }
  return out;
}

/** Short label like "W18 · May 4–10" for tracker headers. */
export function weekShortLabel(key: string): string {
  const range = weekRange(key);
  const parts = parseWeekKey(key);
  if (!range || !parts) return key;
  const startLabel = pkt(range.start).format("MMM D");
  const endLabel = pkt(range.end).format("MMM D");
  return `W${String(parts.week).padStart(2, "0")} · ${startLabel}–${endLabel}`;
}
