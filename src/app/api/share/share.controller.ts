/**
 * Share controller.
 *
 * Composes a single read-only payload for the public /share page. Callable
 * two ways:
 *
 *   1. From the route handler (`GET /api/share/[id]`) — returns NextResponse.
 *   2. Directly from the share Server Component (`buildPayload`) — returns
 *      the typed `SharePayload`. Skipping HTTP avoids a self-call round-trip
 *      and keeps the page fast.
 *
 * Auth: this controller does NOT enforce session auth. The /share routes are
 * bypassed in middleware.ts; knowing the influencer ObjectId is the bearer
 * credential.
 *
 * Tenancy: every share link is implicitly bound to a single agency. The
 * primary influencer's `agencyId` becomes the boundary; every other id in
 * the roster MUST belong to the same agency or it's silently dropped.
 * Subreddits are pre-filtered by the same `agencyId`. This means a leaked
 * URL can never escape into another agency's data even if the requester
 * appends a foreign id.
 *
 * OnlyFans is intentionally excluded from share payloads — share links
 * carry growth-only stats so revenue/spend never reaches the renderer.
 */
import "server-only";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { connectMongo } from "@/lib/db/mongo";
import { InfluencerModel, type InfluencerDoc } from "@/app/api/influencers/influencers.model";
import { WeeklyEntryModel, type WeeklyEntryDoc } from "@/app/api/entries/entries.model";
import { subredditsController } from "@/app/api/subreddits/subreddits.controller";
import {
  PLATFORMS,
  PLATFORM_KEYS,
  type PlatformDefinition,
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
import type { SharePayload, ShareRosterMember } from "@/lib/share/types";

const HISTORY_WEEKS = 12;

/**
 * Share links carry growth-only stats. OnlyFans is the revenue platform —
 * we deliberately exclude it from share payloads so recipients (often
 * agencies / external stakeholders) only see public-friendly metrics.
 */
const SHARE_PLATFORM_KEYS: PlatformKey[] = ["reddit", "instagram", "x"];

const SHARE_PLATFORMS: Partial<Record<PlatformKey, PlatformDefinition>> = (() => {
  const out: Partial<Record<PlatformKey, PlatformDefinition>> = {};
  for (const k of SHARE_PLATFORM_KEYS) out[k] = PLATFORMS[k];
  return out;
})();

class ShareController {
  /* ---------------------------------------------------------------------- */
  /*  Public composer (used by Server Component + route handler)            */
  /* ---------------------------------------------------------------------- */

  async buildPayload(args: {
    influencerId: string;
    range: DashboardRange;
    /**
     * IDs of all models reachable from this share link, used to populate
     * the recipient-side switcher. The currently-shown `influencerId` MUST
     * be in this list; if omitted, the roster is just `[influencerId]`.
     * IDs that don't belong to the primary's agency are silently dropped.
     */
    rosterIds?: string[];
  }): Promise<SharePayload> {
    if (!mongoose.isValidObjectId(args.influencerId)) {
      throw new ShareNotFoundError("Invalid influencer id");
    }

    await connectMongo();
    const doc = await InfluencerModel.findById(args.influencerId).lean<InfluencerDoc>();
    if (!doc) throw new ShareNotFoundError("Influencer not found");
    // Influencers created before the agency tenancy feature shipped won't
    // have agencyId — they were wiped at the cutover, but defend anyway.
    if (!doc.agencyId) throw new ShareNotFoundError("Influencer not found");
    const agencyId = doc.agencyId.toString();

    const influencer = this.toInfluencerJson(doc);
    const window = rangeToDates(args.range);
    const weekKeys = lastNWeeks(HISTORY_WEEKS);

    const requestedRosterIds =
      args.rosterIds && args.rosterIds.length > 0
        ? args.rosterIds
        : [args.influencerId];

    const [entriesByPlatform, roster, subreddits] = await Promise.all([
      // Growth platforms only — OnlyFans is excluded server-side so revenue
      // data never reaches the share renderer, even if the URL is leaked.
      this.fetchEntries(args.influencerId, agencyId, SHARE_PLATFORM_KEYS, weekKeys),
      // Roster is restricted to influencers in the same agency. Foreign ids
      // are silently dropped — we don't acknowledge their existence.
      this.fetchRosterSummaries(requestedRosterIds, agencyId),
      // Subreddits filtered to the roster + active agency. Cross-agency
      // subreddits never appear in the share payload.
      subredditsController.fetchListWithLatest({
        agencyId,
        influencerIds: requestedRosterIds,
      }),
    ]);

    return {
      influencer,
      range: args.range,
      window: {
        startISO: window.start.toISOString(),
        endISO: window.end.toISOString(),
      },
      entries: entriesByPlatform,
      platforms: SHARE_PLATFORMS,
      roster,
      subreddits,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Fetch a minimal summary (id + name) for every requested influencer that
   * belongs to `agencyId`. Other ids are silently dropped.
   *
   * Used to populate the share switcher dropdown without round-tripping for
   * each model individually.
   */
  async fetchRosterSummaries(
    ids: string[],
    agencyId: string,
  ): Promise<ShareRosterMember[]> {
    const validIds = ids.filter((id) => mongoose.isValidObjectId(id));
    if (validIds.length === 0) return [];

    await connectMongo();
    const objIds = validIds.map((id) => new mongoose.Types.ObjectId(id));
    const docs = await InfluencerModel.find({
      _id: { $in: objIds },
      agencyId: new mongoose.Types.ObjectId(agencyId),
    })
      .select({ _id: 1, name: 1 })
      .lean<Array<Pick<InfluencerDoc, "_id" | "name">>>();

    // Preserve the caller's order so the dropdown matches the share-link
    // sequence rather than Mongo's internal order.
    const byId = new Map(docs.map((d) => [d._id.toString(), d.name]));
    return validIds
      .map((id) => {
        const name = byId.get(id);
        return name ? { _id: id, name } : null;
      })
      .filter((m): m is ShareRosterMember => m !== null);
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
    agencyId: string,
    platforms: readonly PlatformKey[],
    weekKeys: string[],
  ): Promise<Partial<Record<PlatformKey, WeeklyEntry[]>>> {
    const docs = await WeeklyEntryModel.find({
      agencyId: new mongoose.Types.ObjectId(agencyId),
      influencerId: new mongoose.Types.ObjectId(influencerId),
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
    const notes: Record<string, string> = {};
    if (doc.notes instanceof Map) {
      for (const [k, v] of doc.notes.entries()) notes[k] = v;
    } else if (doc.notes && typeof doc.notes === "object") {
      for (const [k, v] of Object.entries(doc.notes)) {
        if (typeof v === "string") notes[k] = v;
      }
    }
    return {
      _id: doc._id.toString(),
      influencerId: doc.influencerId.toString(),
      platform: doc.platform as PlatformKey,
      weekKey: doc.weekKey,
      data,
      notes,
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
