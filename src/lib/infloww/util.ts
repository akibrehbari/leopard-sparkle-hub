/**
 * Pure helpers for normalizing Infloww data shapes.
 *
 * Infloww returns timestamps as strings (sometimes unix-ms, sometimes ISO),
 * and money fields in inconsistent units. These helpers hide those quirks.
 */

/**
 * Normalize an Infloww timestamp value to a Date.
 *
 * Accepts:
 *   - "1750019015000"       → unix milliseconds string
 *   - 1750019015000         → unix milliseconds number
 *   - "2024-01-01T00:00:00Z" → ISO 8601 string
 *
 * Returns null on parse failure.
 */
export function parseInflowwTime(
  value: string | number | null | undefined,
): Date | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value);
  }

  const str = String(value).trim();

  // Numeric string → unix ms.
  if (/^\d{10,}$/.test(str)) {
    const n = Number(str);
    if (Number.isFinite(n)) return new Date(n);
  }

  // Fall back to native Date parser (ISO 8601, etc).
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Convert an Infloww money value to USD (or whatever currency the response
 * declares). The Infloww API returns:
 *   - transactions: string in cents       ("7400" → 74.00)
 *   - links:        integer cents         (150000 → 1500.00)
 *   - linkfans:     integer cents
 *   - refunds:      number (decimal $$$)  (29.99 → 29.99)
 *
 * `unit` selects the interpretation; defaults to "cents".
 */
export function inflowwAmount(
  value: string | number | null | undefined,
  unit: "cents" | "decimal" = "cents",
): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return unit === "cents" ? n / 100 : n;
}

/**
 * Format a USD number as "$1,234" (no fractional part) or "$1,234.56" (with)
 * — matching the existing dashboard convention.
 */
export function formatUSD(value: number, options: { fractional?: boolean } = {}): string {
  const { fractional = false } = options;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractional ? 2 : 0,
    maximumFractionDigits: fractional ? 2 : 0,
  }).format(value);
}

/** Format a number as a localized integer ("1,234"). */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

/** Truncate a Date to local-day midnight (used for daily aggregation). */
export function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

/** "YYYY-MM-DD" key for a Date in local time, used as a stable map key. */
export function dayKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Short month-day label ("Mar 14") for chart axes. */
export function shortDateLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
