/**
 * Shared agency types (used by both browser and server).
 * The `_id` is always serialized as a string in JSON responses.
 *
 * Passwords are NEVER returned in any API response — `ownerPasswordHash`
 * exists in the DB doc but never on the wire.
 */

export interface Agency {
  _id: string;
  name: string;
  ownerUsername: string;
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

/** Body for POST /api/agencies (create). All fields required. */
export interface CreateAgencyBody {
  name: string;
  ownerUsername: string;
  ownerPassword: string;
}

/**
 * Body for PATCH /api/agencies/:id. All fields optional — pass only what's
 * changing. `ownerPassword` is the new plaintext password (rotated server
 * side via bcrypt); omit to leave the password untouched.
 */
export interface UpdateAgencyBody {
  name?: string;
  ownerUsername?: string;
  ownerPassword?: string;
}
