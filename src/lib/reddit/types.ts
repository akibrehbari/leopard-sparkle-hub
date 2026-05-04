/**
 * Minimal typings for the slice of Reddit's public JSON API we consume.
 *
 * Reddit returns a much larger payload than what we capture here. We type
 * only the fields we read so a future Reddit shape change in unused fields
 * doesn't break compilation.
 */

export interface RedditAbout {
  /** The bare subreddit name as Reddit stores it (preserved case). */
  display_name: string;
  /** Total cumulative subscriber count. Drives the weekly delta. */
  subscribers: number | null;
  /** Snapshot of users currently online; can be null on private/quarantined subs. */
  active_user_count: number | null;
  /** Short description shown on the sidebar. */
  public_description: string | null;
  /** NSFW flag. */
  over18: boolean;
  /** Subreddit creation timestamp (unix seconds, UTC). */
  created_utc: number | null;
}

export interface RedditPost {
  id: string;
  title: string;
  /** Karma at fetch time. */
  score: number;
  /** Permalink path (e.g. "/r/foo/comments/abc/title/"); always absolute when prefixed with reddit.com. */
  permalink: string;
  /** External URL the post points at, often the same as Reddit's own permalink for self-posts. */
  url: string;
  author: string;
  /** Post creation timestamp (unix seconds, UTC). */
  created_utc: number;
}

/**
 * The week's top post snapshot we persist per sync. Decoupled from
 * RedditPost so our DB shape stays narrow even if Reddit changes.
 */
export interface RedditTopPost {
  title: string;
  score: number;
  url: string;
  permalink: string;
  author: string;
}

/**
 * Composite snapshot built by `fetchSubredditDigest` — exactly what the
 * upserter needs to write a `subreddit_snapshots` document.
 */
export interface RedditDigest {
  /** Fields lifted off about.json, used to refresh the parent subreddits doc. */
  meta: {
    displayName: string;
    description: string | null;
    over18: boolean;
  };
  subscribers: number;
  activeUsers: number | null;
  postsLast7d: number;
  topPost: RedditTopPost | null;
}
