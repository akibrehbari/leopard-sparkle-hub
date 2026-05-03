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
  createdAt: string;
  updatedAt: string;
}

/** Body for POST /api/influencers (create). */
export interface CreateInfluencerBody {
  name: string;
  handles?: InfluencerHandles;
}

/** Body for PATCH /api/influencers/:id (edit handles / rename). */
export interface UpdateInfluencerBody {
  name?: string;
  handles?: InfluencerHandles;
}
