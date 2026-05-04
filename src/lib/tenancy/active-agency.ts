/**
 * Cookie shared between the agency switcher (browser) and the tenancy
 * resolver (server) for admin / editor sessions.
 *
 * Why a cookie and not a header / search param?
 *   - Travels automatically with every fetch (including TanStack Query
 *     refetches and Server Component RSC requests) so we don't have to
 *     thread the value through every call site.
 *   - HttpOnly intentionally OFF: the client UI also reads it to know
 *     which agency is "active" without an extra round-trip. The cookie
 *     value is just an ObjectId — non-secret; the actual authorization
 *     decision happens server-side via `resolveAgencyContext`.
 *
 * Agency-owner sessions ignore this cookie and use the `agencyId` baked
 * into their JWT instead, so a hostile owner can't rebind to a different
 * agency by editing the cookie.
 */

export const ACTIVE_AGENCY_COOKIE = "active_agency_id";

/**
 * 30 days. The cookie is just a UI preference — the server still
 * validates the value against the agencies collection on every request.
 */
export const ACTIVE_AGENCY_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export const activeAgencyCookieOptions = {
  httpOnly: false as const,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: ACTIVE_AGENCY_COOKIE_MAX_AGE,
};
