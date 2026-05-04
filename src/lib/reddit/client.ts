/**
 * Reddit public-JSON client.
 *
 * Uses Reddit's unauthenticated JSON endpoints (no OAuth, no env vars). The
 * usual rate limit is ~60 req/min per IP — fine for a Sunday sync of ~30
 * subreddits when batched. We send a stable User-Agent because Reddit blocks
 * the default Node fetch UA with HTTP 429 / 403.
 *
 * All functions throw `RedditFetchError` on transport failure; consumers
 * should wrap in `Promise.allSettled` (the controller does).
 */
import "server-only";

import type {
  RedditAbout,
  RedditDigest,
  RedditPost,
  RedditTopPost,
} from "./types";

const REDDIT_BASE = "https://www.reddit.com";
const USER_AGENT = "eleopards-dashboard/1.0 (internal-tooling)";
/** Per-request timeout. Reddit usually responds in <1s; 8s is generous. */
const REQUEST_TIMEOUT_MS = 8_000;

export class RedditFetchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "RedditFetchError";
  }
}

async function redditGet<T>(path: string): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${REDDIT_BASE}${path}`, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      // Disable Next's data cache; we want each Sunday sync to hit Reddit
      // live, not return a stale cached response.
      cache: "no-store",
      signal: ctl.signal,
    });
    if (!res.ok) {
      throw new RedditFetchError(
        `Reddit request failed: ${res.status} ${res.statusText} for ${path}`,
        res.status,
      );
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof RedditFetchError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new RedditFetchError(`Reddit request timed out after ${REQUEST_TIMEOUT_MS}ms: ${path}`);
    }
    throw new RedditFetchError(
      `Reddit request failed for ${path}: ${(err as Error)?.message ?? String(err)}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Normalize a subreddit name as the operator might enter it
 * ("r/AskReddit", "/r/AskReddit/", "AskReddit") into the bare form Reddit's
 * URLs expect.
 */
export function normalizeSubredditName(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\/(www\.)?reddit\.com\//i, "")
    .replace(/^\/?r\//i, "")
    .replace(/\/+$/g, "")
    .toLowerCase();
}

/* -------------------------------------------------------------------------- */
/*  Endpoint wrappers                                                         */
/* -------------------------------------------------------------------------- */

interface AboutEnvelope {
  data?: RedditAbout;
}

export async function fetchSubredditAbout(name: string): Promise<RedditAbout | null> {
  const safe = normalizeSubredditName(name);
  if (!safe) return null;
  try {
    const env = await redditGet<AboutEnvelope>(`/r/${encodeURIComponent(safe)}/about.json`);
    return env?.data ?? null;
  } catch (err) {
    // 404 / 403 (private, banned) — treat as "subreddit not visible" rather
    // than as a transport error, so the caller can show a friendly message.
    if (err instanceof RedditFetchError && (err.status === 404 || err.status === 403)) {
      return null;
    }
    throw err;
  }
}

interface ListingEnvelope {
  data?: {
    children?: Array<{ data?: RedditPost }>;
  };
}

export async function fetchSubredditNewPosts(
  name: string,
  limit = 100,
): Promise<RedditPost[]> {
  const safe = normalizeSubredditName(name);
  if (!safe) return [];
  const clamped = Math.max(1, Math.min(100, Math.floor(limit)));
  try {
    const env = await redditGet<ListingEnvelope>(
      `/r/${encodeURIComponent(safe)}/new.json?limit=${clamped}&raw_json=1`,
    );
    const children = env?.data?.children ?? [];
    return children
      .map((c) => c.data)
      .filter((p): p is RedditPost => Boolean(p && typeof p.id === "string"));
  } catch (err) {
    if (err instanceof RedditFetchError && (err.status === 404 || err.status === 403)) {
      return [];
    }
    throw err;
  }
}

/* -------------------------------------------------------------------------- */
/*  Pure helpers                                                              */
/* -------------------------------------------------------------------------- */

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

export function countPostsLast7d(
  posts: readonly RedditPost[],
  now: Date = new Date(),
): number {
  const cutoff = Math.floor(now.getTime() / 1000) - SEVEN_DAYS_SECONDS;
  return posts.reduce((acc, p) => (p.created_utc >= cutoff ? acc + 1 : acc), 0);
}

/**
 * Pick the highest-scoring post created in the last 7 days. Returns null
 * when no qualifying post exists.
 */
export function pickTopPost(
  posts: readonly RedditPost[],
  now: Date = new Date(),
): RedditTopPost | null {
  const cutoff = Math.floor(now.getTime() / 1000) - SEVEN_DAYS_SECONDS;
  const eligible = posts.filter((p) => p.created_utc >= cutoff);
  if (eligible.length === 0) return null;
  const top = eligible.reduce((best, p) => (p.score > best.score ? p : best), eligible[0]);
  return {
    title: top.title,
    score: top.score,
    url: top.url,
    permalink: top.permalink.startsWith("http")
      ? top.permalink
      : `${REDDIT_BASE}${top.permalink}`,
    author: top.author,
  };
}

/* -------------------------------------------------------------------------- */
/*  High-level composer                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Composite snapshot used by the sync controller. Fetches about + new posts
 * in parallel and returns a single typed object the upserter can consume.
 *
 * Returns null when the subreddit is unreachable or doesn't exist (the
 * controller surfaces this as a per-row failure, not a sync abort).
 */
export async function fetchSubredditDigest(
  name: string,
  now: Date = new Date(),
): Promise<RedditDigest | null> {
  const [about, posts] = await Promise.all([
    fetchSubredditAbout(name),
    fetchSubredditNewPosts(name),
  ]);

  if (!about) return null;

  return {
    meta: {
      displayName: about.display_name ?? name,
      description: about.public_description ?? null,
      over18: Boolean(about.over18),
    },
    subscribers: typeof about.subscribers === "number" ? about.subscribers : 0,
    activeUsers:
      typeof about.active_user_count === "number" ? about.active_user_count : null,
    postsLast7d: countPostsLast7d(posts, now),
    topPost: pickTopPost(posts, now),
  };
}
