/**
 * Subreddit types shared between server (controller / route handlers) and
 * browser (service / hooks / components).
 */

export interface SubredditSnapshot {
  _id: string;
  subredditId: string;
  /** ISO week key in PKT, e.g. "2026-W18". */
  weekKey: string;
  followers: number;
  contributions: number;
  weeklyVisits: number;
}

export interface Subreddit {
  _id: string;
  /** Lowercased canonical name. */
  name: string;
  /** Preserved-case display name, defaults to name. */
  displayName: string;
  category: string;
  influencerId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Subreddit + the latest snapshot + a computed weekly delta. Returned by the
 * list endpoint so the table renders without a second fetch.
 */
export interface SubredditWithLatest extends Subreddit {
  latest: SubredditSnapshot | null;
  prior: SubredditSnapshot | null;
  weeklyDelta: number | null;
}

export interface CreateSubredditBody {
  name: string;
  category: string;
  influencerId?: string | null;
}

export interface UpdateSubredditBody {
  category?: string;
  influencerId?: string | null;
}

export interface UpsertSubredditSnapshotBody {
  subredditId: string;
  weekKey: string;
  followers: number;
  contributions: number;
  weeklyVisits: number;
}
