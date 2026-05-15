/**
 * Pure helpers for building & parsing the multi-model share URL.
 *
 * Shape: `/share?ids=a,b,c&selected=a&range=30d`
 *
 * Living in its own module so both the operator-side dialog (browser) and
 * the recipient-side route (server component) can share the same parsing
 * + serialization logic without pulling each other's deps.
 */

import { DASHBOARD_RANGES, type DashboardRange } from "@/lib/utils/range";

export interface ShareLinkParts {
  ids: string[];
  selected: string;
  range: DashboardRange;
}

export function buildShareUrl(parts: ShareLinkParts): string {
  const { ids, selected, range } = parts;
  if (ids.length === 0) return "/share";
  const safeSelected = ids.includes(selected) ? selected : ids[0];
  const params = new URLSearchParams({
    ids: ids.join(","),
    selected: safeSelected,
    range,
  });
  return `/share?${params.toString()}`;
}

/**
 * Parse the search params on the recipient side, normalizing edge cases:
 * - `ids=` may be missing → returns null (caller should 404).
 * - `selected` not in `ids` → falls back to the first id.
 * - `range` invalid → falls back to "30d".
 *
 * IDs are NOT validated as ObjectIds here; the controller does that.
 */
export function parseShareParams(raw: {
  ids?: string | string[] | null;
  selected?: string | string[] | null;
  range?: string | string[] | null;
}): ShareLinkParts | null {
  const idsRaw = firstString(raw.ids);
  const selectedRaw = firstString(raw.selected);
  const rangeRaw = firstString(raw.range);

  if (!idsRaw) return null;
  const ids = Array.from(
    new Set(
      idsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
  if (ids.length === 0) return null;

  const selected =
    selectedRaw && ids.includes(selectedRaw) ? selectedRaw : ids[0];
  const range = (DASHBOARD_RANGES as readonly string[]).includes(rangeRaw ?? "")
    ? (rangeRaw as DashboardRange)
    : "4w";

  return { ids, selected, range };
}

function firstString(input: string | string[] | null | undefined): string | null {
  if (Array.isArray(input)) return input[0] ?? null;
  return input ?? null;
}
