/**
 * Shared influencer types (used by both browser and server).
 * The `_id` is always serialized as a string in JSON responses.
 */

import type { PlatformKey } from "@/lib/platforms/registry";

/**
 * Per-platform handle (e.g. "u/carlitos" stored as "carlitos"). Empty/missing
 * means the influencer doesn't have / hasn't connected an account on that
 * platform; the dashboard still shows the platform's section so weekly data
 * can be entered.
 */
export type InfluencerHandles = Partial<Record<PlatformKey, string>>;

export interface Influencer {
  _id: string;
  name: string;
  handles: InfluencerHandles;
  /** Set when the influencer has portal login credentials. */
  loginUsername?: string | null;
  /** Infloww creator ID — used to auto-fetch OnlyFans subscriber count. */
  inflowwCreatorId?: string | null;
  /** Internal notes written by workers/admins — NOT visible to the influencer. */
  marketingNotes?: string | null;
  ofNotes?: string | null;
  /** Weekly tracker notes editable by data-entry workers. */
  trackerNotes?: string | null;
  /** Public URL of the influencer's avatar image. */
  avatarUrl?: string | null;
  /** Manual sort position — lower = higher in list. */
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
}

/** Body for POST /api/influencers (create). */
export interface CreateInfluencerBody {
  name: string;
  handles?: InfluencerHandles;
  inflowwCreatorId?: string;
  loginUsername?: string;
  loginPassword?: string;
  avatarUrl?: string;
}

/** Body for PATCH /api/influencers/:id (edit). */
export interface UpdateInfluencerBody {
  name?: string;
  handles?: InfluencerHandles;
  inflowwCreatorId?: string | null;
  loginUsername?: string;
  loginPassword?: string;
  marketingNotes?: string | null;
  ofNotes?: string | null;
  trackerNotes?: string | null;
  avatarUrl?: string | null;
}
