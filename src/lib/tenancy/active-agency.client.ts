"use client";

/**
 * Browser helpers for the active-agency cookie.
 *
 * The cookie itself is set/cleared by the server (`POST /api/agencies/active`).
 * These helpers exist purely to read the value client-side so the topbar
 * switcher knows which option to render as "current" without an extra
 * network hop.
 *
 * The cookie is intentionally NOT HttpOnly — it's a UI preference, not a
 * secret. The actual authorization decision happens server-side.
 */

import { ACTIVE_AGENCY_COOKIE } from "./active-agency";

export function readActiveAgencyCookie(): string | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${ACTIVE_AGENCY_COOKIE}=`));
  if (!raw) return null;
  const value = raw.slice(ACTIVE_AGENCY_COOKIE.length + 1);
  return value || null;
}
