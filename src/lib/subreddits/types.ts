/**
 * Subreddit types shared between server (controller / route handlers) and
 * browser (service / hooks / components).
 */

export interface SubredditTopPost {
  title: string;
  score: number;
  url: string;
  permalink: string;
  author: string;
}

export interface SubredditSnapshot {
  _id: string;
  subredditId: string;
  /** ISO week key in PKT, e.g. "2026-W18". */
  weekKey: string;
  subscribers: number;
  activeUsers: number | null;
  postsLast7d: number;
  topPost: SubredditTopPost | null;
  syncedAt: string;
}

export interface Subreddit {
  _id: string;
  /** Lowercased canonical name. */
  name: string;
  /** Reddit's preserved-case name. */
  displayName: string;
  category: string;
  influencerId: string | null;
  description: string | null;
  over18: boolean;
  lastSyncedAt: string | null;
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

export interface SyncResult {
  total: number;
  synced: number;
  failed: Array<{ name: string; error: string }>;
  weekKey: string;
  syncedAt: string;
}
