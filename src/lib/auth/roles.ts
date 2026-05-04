/**
 * Role definitions for the dashboard.
 *
 * `admin` — full access. Can create/edit/delete influencers and subreddits,
 *   plus everything the editor can do.
 *
 * `editor` — can view all data, do weekly entry, sync subreddits, and
 *   create share links. Cannot create/edit/delete influencers or subreddits.
 *
 * Membership is decided at login time by which env credential matched
 * (`ADMIN_*` vs `EDITOR_*`). Roles are baked into the session JWT so
 * downstream guards don't need to re-check env.
 */

export type Role = "admin" | "editor";

export const ROLES: readonly Role[] = ["admin", "editor"];

export function isRole(value: unknown): value is Role {
  return value === "admin" || value === "editor";
}

/** Convenience: editors can do almost everything except admin-only mutations. */
export function isAdmin(role: Role | null | undefined): boolean {
  return role === "admin";
}
