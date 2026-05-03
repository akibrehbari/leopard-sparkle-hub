/**
 * Display formatters used across the dashboard, tracker, and share page.
 *
 * Pure functions, no side effects. Currency values are passed in as USD
 * (e.g. `1234.56`); call `centsToUsd` first if you have an integer cents
 * value coming out of Mongo.
 */

export interface FormatUsdOptions {
  /** Show two decimals (`$1,234.56`) rather than rounding to dollars (`$1,234`). */
  fractional?: boolean;
}

export function formatUSD(value: number, options: FormatUsdOptions = {}): string {
  const { fractional = false } = options;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractional ? 2 : 0,
    maximumFractionDigits: fractional ? 2 : 0,
  }).format(Number.isFinite(value) ? value : 0);
}

/** Format a number as a localized integer (`1,234`). Coerces NaN to 0. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(
    Number.isFinite(value) ? Math.round(value) : 0,
  );
}

/** Compact integer formatting (`1.2K`, `3.4M`). Useful for chart axes. */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);
}

/** Format a signed integer with explicit `+` for non-negative values. */
export function formatSignedInt(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)}`;
}

/** Format a signed dollar amount with explicit `+` for non-negative values. */
export function formatSignedUsd(value: number, options: FormatUsdOptions = {}): string {
  if (!Number.isFinite(value)) return formatUSD(0, options);
  const abs = formatUSD(Math.abs(value), options);
  if (value > 0) return `+${abs}`;
  if (value < 0) return `-${abs}`;
  return abs;
}

/** Format a percent value already in 0–100 range (`12.3%`). */
export function formatPercent(value: number, fractionDigits = 1): string {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(fractionDigits)}%`;
}

/** Convert integer cents (storage unit) to USD dollars (display unit). */
export function centsToUsd(cents: number): number {
  if (!Number.isFinite(cents)) return 0;
  return cents / 100;
}

/** Convert USD dollars (input unit) to integer cents (storage unit). */
export function usdToCents(usd: number): number {
  if (!Number.isFinite(usd)) return 0;
  return Math.round(usd * 100);
}
