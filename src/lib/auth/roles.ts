/**
 * Role definitions for the dashboard.
 *
 * `admin` — full access. Can create/edit/delete agencies, influencers,
 *   workers, and subreddits. Sees all financial data. Picks an active agency
 *   via the global agency switcher.
 *
 * `editor` — can view all data within the active agency, do weekly entry,
 *   sync subreddits, and create share links. Cannot create/edit/delete
 *   agencies, influencers, workers, or subreddits.
 *
 * `agency_owner` — pinned to a single agency at login. Can create and manage
 *   influencers and workers within their agency, set credentials manually.
 *   Sees financial data for their agency. Cannot switch agencies.
 *
 * `worker` — pinned to a single agency at login. Can enter weekly data for
 *   their assigned influencers and write reviews. Sees NO financial data
 *   (no revenue, spend, ROI, ROAS). Credentials set by agency_owner / admin.
 *
 * `influencer` — pinned to their own record. Sees only their own platform
 *   stats, subscriber count, and team reviews. Sees NO financial data.
 *   Credentials set by agency_owner / admin.
 */

export type Role = "admin" | "editor" | "agency_owner" | "worker" | "influencer";

export const ROLES: readonly Role[] = [
  "admin",
  "editor",
  "agency_owner",
  "worker",
  "influencer",
];

export function isRole(value: unknown): value is Role {
  return (
    value === "admin" ||
    value === "editor" ||
    value === "agency_owner" ||
    value === "worker" ||
    value === "influencer"
  );
}

/** Only super admins. */
export function isAdmin(role: Role | null | undefined): boolean {
  return role === "admin";
}

/** Editors and admins can do data entry and syncs. */
export function isEditorOrAdmin(role: Role | null | undefined): boolean {
  return role === "admin" || role === "editor";
}

/** Admin or agency_owner can manage users (influencers, workers) within an agency. */
export function isManager(role: Role | null | undefined): boolean {
  return role === "admin" || role === "agency_owner";
}

/** Workers, editors, and admins can enter weekly data / write reviews. */
export function canEnterData(role: Role | null | undefined): boolean {
  return role === "admin" || role === "editor" || role === "worker";
}

/** Roles that can see financial data (revenue, spend, ROI). */
export function canSeeFinancials(role: Role | null | undefined): boolean {
  return role === "admin" || role === "editor" || role === "agency_owner";
}

export function isAgencyOwner(role: Role | null | undefined): boolean {
  return role === "agency_owner";
}

export function isInfluencer(role: Role | null | undefined): boolean {
  return role === "influencer";
}

export function isWorker(role: Role | null | undefined): boolean {
  return role === "worker";
}
