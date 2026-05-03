/**
 * Shared influencer types (used by both browser and server).
 * The `_id` is always serialized as a string in JSON responses.
 */

export interface InfluencerHandles {
  reddit?: string;
  instagram?: string;
}

export interface Influencer {
  _id: string;
  name: string;
  /** Present when this influencer was synced from Infloww. */
  inflowwCreatorId?: string;
  /** Cached so we can render the @handle without an Infloww round-trip. */
  inflowwUserName?: string;
  handles: InfluencerHandles;
  /** True for influencers created via the manual-add form (no Infloww account). */
  isManual: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Body for POST /api/influencers (manual create). */
export interface CreateInfluencerBody {
  name: string;
  handles?: InfluencerHandles;
}

/** Body for PATCH /api/influencers/:id (edit handles / rename). */
export interface UpdateInfluencerBody {
  name?: string;
  handles?: InfluencerHandles;
}

/** Result of POST /api/influencers/sync. */
export interface SyncResult {
  fetched: number;
  created: number;
  updated: number;
  total: number;
}
