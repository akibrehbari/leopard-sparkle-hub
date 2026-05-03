/**
 * Share controller.
 *
 * Composes a single read-only payload for the public /share/[id] page. The
 * controller is callable two ways:
 *
 *   1. From the route handler (`GET /api/share/[id]`) — returns NextResponse.
 *   2. Directly from the share Server Component (`buildPayload`) — returns
 *      the typed `SharePayload`. Skipping HTTP avoids a self-call round-trip
 *      and keeps the page fast.
 *
 * Auth: this controller does NOT enforce auth. The /share routes are bypassed
 * in middleware.ts; knowing the influencer ObjectId is the bearer credential.
 */
import "server-only";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { connectMongo } from "@/lib/db/mongo";
import { InfluencerModel, type InfluencerDoc } from "@/app/api/influencers/influencers.model";
import { WeeklyEntryModel, type WeeklyEntryDoc } from "@/app/api/entries/entries.model";
import {
  PLATFORMS,
  PLATFORM_KEYS,
  type PlatformKey,
} from "@/lib/platforms/registry";
import { lastNWeeks } from "@/lib/utils/week";
import {
  DASHBOARD_RANGES,
  rangeToDates,
  type DashboardRange,
} from "@/lib/utils/range";
import type { Influencer, InfluencerHandles } from "@/lib/influencers/types";
import type { WeeklyEntry } from "@/lib/entries/types";
import type { SharePayload } from "@/lib/share/types";

const HISTORY_WEEKS = 12;

class ShareController {
  /* ---------------------------------------------------------------------- */
  /*  Public composer (used by Server Component + route handler)            */
  /* ---------------------------------------------------------------------- */

  async buildPayload(args: {
    influencerId: string;
    range: DashboardRange;
  }): Promise<SharePayload> {
    if (!mongoose.isValidObjectId(args.influencerId)) {
      throw new ShareNotFoundError("Invalid influencer id");
    }

    await connectMongo();
    const doc = await InfluencerModel.findById(args.influencerId).lean<InfluencerDoc>();
    if (!doc) throw new ShareNotFoundError("Influencer not found");

    const influencer = this.toInfluencerJson(doc);
    const window = rangeToDates(args.range);
    const weekKeys = lastNWeeks(HISTORY_WEEKS);

    const entriesByPlatform = await this.fetchEntries(
      args.influencerId,
      PLATFORM_KEYS,
      weekKeys,
    );

    return {
      influencer,
      range: args.range,
      window: {
        startISO: window.start.toISOString(),
        endISO: window.end.toISOString(),
      },
      entries: entriesByPlatform,
      platforms: PLATFORMS,
      generatedAt: new Date().toISOString(),
    };
  }

  /* ---------------------------------------------------------------------- */
  /*  Route handler                                                         */
  /* ---------------------------------------------------------------------- */

  async handleGet(request: NextRequest, id: string): Promise<NextResponse> {
    try {
      const sp = new URL(request.url).searchParams;
      const range = this.parseRange(sp.get("range"));
      const payload = await this.buildPayload({ influencerId: id, range });
      return NextResponse.json({ data: payload });
    } catch (err) {
      if (err instanceof ShareNotFoundError) {
        return NextResponse.json({ error: err.message }, { status: 404 });
      }
      console.error("[share] error", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Internal Server Error" },
        { status: 500 },
      );
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Internals                                                             */
  /* ---------------------------------------------------------------------- */

  private parseRange(raw: string | null): DashboardRange {
    if (raw && (DASHBOARD_RANGES as readonly string[]).includes(raw)) {
      return raw as DashboardRange;
    }
    return "30d";
  }

  private async fetchEntries(
    influencerId: string,
    platforms: readonly PlatformKey[],
    weekKeys: string[],
  ): Promise<Partial<Record<PlatformKey, WeeklyEntry[]>>> {
    const _id = new mongoose.Types.ObjectId(influencerId);
    const docs = await WeeklyEntryModel.find({
      influencerId: _id,
      platform: { $in: platforms as PlatformKey[] },
      weekKey: { $in: weekKeys },
    }).lean<WeeklyEntryDoc[]>();

    const out: Partial<Record<PlatformKey, WeeklyEntry[]>> = {};
    for (const p of platforms) out[p] = [];
    for (const d of docs) {
      const entry = this.toEntryJson(d);
      const bucket = out[entry.platform];
      if (bucket) bucket.push(entry);
    }
    return out;
  }

  private toInfluencerJson(doc: InfluencerDoc): Influencer {
    const handles: InfluencerHandles = {};
    for (const key of PLATFORM_KEYS) {
      const v = doc.handles?.[key];
      if (v) handles[key] = v;
    }
    return {
      _id: doc._id.toString(),
      name: doc.name,
      handles,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  private toEntryJson(doc: WeeklyEntryDoc): WeeklyEntry {
    const data: Record<string, number> = {};
    if (doc.data instanceof Map) {
      for (const [k, v] of doc.data.entries()) data[k] = v;
    } else if (doc.data && typeof doc.data === "object") {
      for (const [k, v] of Object.entries(doc.data)) {
        if (typeof v === "number") data[k] = v;
      }
    }
    return {
      _id: doc._id.toString(),
      influencerId: doc.influencerId.toString(),
      platform: doc.platform as PlatformKey,
      weekKey: doc.weekKey,
      data,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }
}

export class ShareNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShareNotFoundError";
  }
}

export const shareController = new ShareController();
