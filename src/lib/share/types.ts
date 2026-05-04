/**
 * Shared types for the public /share/[id] feature.
 *
 * SharePayload is the single, frozen blob that the server hands to the
 * read-only dashboard renderer. It deliberately mirrors the authenticated
 * dashboard's data shape so the same components can render it without
 * conditional branching.
 */

import type { Influencer } from "@/lib/influencers/types";
import type { WeeklyEntry } from "@/lib/entries/types";
import type { PlatformDefinition, PlatformKey } from "@/lib/platforms/registry";
import type { SubredditWithLatest } from "@/lib/subreddits/types";
import type { DashboardRange } from "@/lib/utils/range";

/** A minimal influencer summary suitable for the share switcher dropdown. */
export interface ShareRosterMember {
  _id: string;
  name: string;
}

export interface SharePayload {
  influencer: Influencer;
  range: DashboardRange;
  /** Inclusive ISO timestamps describing the range window for display. */
  window: { startISO: string; endISO: string };
  /**
   * One pre-filtered list per platform key. Empty arrays when no data.
   *
   * Share links are growth-only — OnlyFans entries are deliberately omitted
   * by the server so revenue/spend never appears in shared dashboards.
   */
  entries: Partial<Record<PlatformKey, WeeklyEntry[]>>;
  /**
   * Platform definitions included in this share. Will only contain growth
   * platforms (reddit, instagram, x); OnlyFans is intentionally absent.
   */
  platforms: Partial<Record<PlatformKey, PlatformDefinition>>;
  /**
   * Roster of all influencers reachable from this share link.
   * Always contains at least `influencer` itself. Used to render the
   * recipient-side switcher dropdown.
   */
  roster: ShareRosterMember[];
  /**
   * Subreddits linked to any influencer in the roster, each pre-joined
   * with its latest two snapshots + weekly delta. Filtered client-side
   * by the currently-selected influencer for the per-model section.
   * Subreddits with no linked influencer are intentionally excluded —
   * they aren't tied to anyone in the share so they don't belong here.
   */
  subreddits: SubredditWithLatest[];
  generatedAt: string;
}
