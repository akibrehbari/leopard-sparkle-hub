/** Shared weekly-entry types used by both browser and server. */

import type { PlatformKey } from "@/lib/platforms/registry";

export interface WeeklyEntry {
  _id: string;
  influencerId: string;
  platform: PlatformKey;
  /** ISO week key in PKT, e.g. "2026-W18". */
  weekKey: string;
  data: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

/** POST/PUT body for upserting an entry. */
export interface UpsertEntryBody {
  influencerId: string;
  platform: PlatformKey;
  weekKey: string;
  data: Record<string, number | string>;
}

/** Filter for GET /api/entries. */
export interface ListEntriesParams {
  influencerId?: string;
  platform?: PlatformKey;
  /** Comma-separated weekKeys, e.g. "2026-W17,2026-W18". */
  weekKeys?: string[];
}
