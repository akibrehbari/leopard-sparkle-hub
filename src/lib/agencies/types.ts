/**
 * Shared agency types (used by both browser and server).
 * The `_id` is always serialized as a string in JSON responses.
 *
 * Passwords are NEVER returned in any API response — `ownerPasswordHash`
 * exists in the DB doc but never on the wire.
 */

/**
 * Outbound links rendered in the dashboard topbar for admin and
 * agency-owner sessions. Editors don't see them. Each value is either a
 * full URL or null. Stored on the agency itself so they survive across
 * influencers and aren't lost when models are added/removed.
 */
export interface AgencyLinks {
  onlyfans: string | null;
  infloww: string | null;
  instagram: string | null;
  website: string | null;
}

export const AGENCY_LINK_KEYS = [
  "onlyfans",
  "infloww",
  "instagram",
  "website",
] as const;

export type AgencyLinkKey = (typeof AGENCY_LINK_KEYS)[number];

export const AGENCY_LINK_LABELS: Record<AgencyLinkKey, string> = {
  onlyfans: "OnlyFans",
  infloww: "Infloww",
  instagram: "Instagram",
  website: "Website",
};

export interface Agency {
  _id: string;
  name: string;
  ownerUsername: string;
  links: AgencyLinks;
  /**
   * Counts of related records, joined in by the list endpoint so the
   * agencies table can show "X influencers · Y subreddits" without a
   * separate per-row request.
   */
  counts?: {
    influencers: number;
    subreddits: number;
    weeklyEntries: number;
  };
  createdAt: string;
  updatedAt: string;
}

/** Minimal agency summary for the active-agency switcher dropdown. */
export interface AgencySummary {
  _id: string;
  name: string;
}

/** Body for POST /api/agencies (create). Links default to all-null. */
export interface CreateAgencyBody {
  name: string;
  ownerUsername: string;
  ownerPassword: string;
  links?: Partial<AgencyLinks>;
}

/**
 * Body for PATCH /api/agencies/:id. All fields optional — pass only what's
 * changing. `ownerPassword` is the new plaintext password (rotated server
 * side via bcrypt); omit to leave the password untouched. `links` is a
 * partial object — keys that are absent stay as-is, keys set to null are
 * cleared.
 */
export interface UpdateAgencyBody {
  name?: string;
  ownerUsername?: string;
  ownerPassword?: string;
  links?: Partial<AgencyLinks>;
}
