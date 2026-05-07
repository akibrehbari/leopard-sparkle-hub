/**
 * Role definitions for the dashboard.
 *
 * `admin` — full access. Can create/edit/delete agencies, influencers and
 *   subreddits, plus everything other roles can do. Picks an agency to act
 *   on via the global agency switcher.
 *
 * `editor` — can view all data within the active agency, do weekly entry,
 *   sync subreddits, and create share links. Cannot create/edit/delete
 *   agencies, influencers or subreddits. Picks an agency to act on via the
 *   global agency switcher.
 *
 * `agency_owner` — pinned to a single agency at login. Read-only across that
 *   agency: views influencers, subreddits, dashboards, and can create share
 *   links for their own agency. Cannot mutate anything, cannot sync, cannot
 *   switch agencies. Credentials live in the `agencies` collection (not env).
 *
 * Membership is decided at login time by which credential matched. The role
 * (and, for agency_owner, the bound `agencyId`) is baked into the session
 * JWT so downstream guards don't need to re-check anything.
 */

export type Role = "admin" | "editor" | "agency_owner" | "influencer";

export const ROLES: readonly Role[] = ["admin", "editor", "agency_owner", "influencer"];

export function isRole(value: unknown): value is Role {
  return value === "admin" || value === "editor" || value === "agency_owner" || value === "influencer";
}

/** Convenience: editors and agency owners cannot perform admin-only mutations. */
export function isAdmin(role: Role | null | undefined): boolean {
  return role === "admin";
}

/** Editors and admins can run write actions like data entry and sync. */
export function isEditorOrAdmin(role: Role | null | undefined): boolean {
  return role === "admin" || role === "editor";
}

/** Agency owners are pinned to a specific agency at login time. */
export function isAgencyOwner(role: Role | null | undefined): boolean {
  return role === "agency_owner";
}

/** Influencers are pinned to their own record and see only their own data. */
export function isInfluencer(role: Role | null | undefined): boolean {
  return role === "influencer";
}
