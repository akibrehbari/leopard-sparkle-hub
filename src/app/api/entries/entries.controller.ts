/**
 * Weekly-entries controller.
 *
 * Operations:
 *   - List with filters (influencerId / platform / weekKeys). The tracker
 *     grid uses this to prefetch all visible cells in one round-trip.
 *   - Get one (influencerId + platform + weekKey) — used to prefill the form.
 *   - Upsert — idempotent create-or-update keyed on the unique compound index.
 *   - Delete — clears a single (influencer, platform, week) entry.
 *
 * Tenant-scoped: every read filters by `agencyId`. Every write also verifies
 * the target influencer actually belongs to the active agency before
 * persisting; otherwise an editor on agency A could enter data for an
 * influencer on agency B by guessing the id.
 */
import "server-only";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongo } from "@/lib/db/mongo";
import { WeeklyEntryModel, type WeeklyEntryDoc } from "./entries.model";
import { InfluencerModel } from "@/app/api/influencers/influencers.model";
import {
  isValidPlatform,
  validateEntryData,
  type PlatformKey,
} from "@/lib/platforms/registry";
import { parseWeekKey } from "@/lib/utils/week";
import type { UpsertEntryBody, WeeklyEntry } from "@/lib/entries/types";

class EntriesController {
  private toJson(doc: WeeklyEntryDoc, stripSpend = false): WeeklyEntry {
    let data: Record<string, number> = {};
    if (doc.data instanceof Map) {
      for (const [k, v] of doc.data.entries()) data[k] = v;
    } else if (doc.data && typeof doc.data === "object") {
      for (const [k, v] of Object.entries(doc.data)) {
        if (typeof v === "number") data[k] = v;
      }
    }
    if (stripSpend) data = this.stripSpendFields(data);
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

  private stripSpendFields(data: Record<string, number>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(data)) {
      if (!k.startsWith("spend_")) out[k] = v;
    }
    return out;
  }

  private errorResponse(err: unknown, fallbackStatus = 500): NextResponse {
    if (err instanceof Error) {
      console.error("[entries] error", err);
      return NextResponse.json({ error: err.message }, { status: fallbackStatus });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }

  /**
   * Resolve influencer ownership: returns true iff `influencerId` exists and
   * belongs to `agencyId`. We do this with a tiny `exists` query rather than
   * loading the full doc.
   */
  private async influencerInAgency(
    influencerId: string,
    agencyId: string,
  ): Promise<boolean> {
    if (!mongoose.isValidObjectId(influencerId)) return false;
    return Boolean(
      await InfluencerModel.exists({
        _id: influencerId,
        agencyId: new mongoose.Types.ObjectId(agencyId),
      }),
    );
  }

  /* ---------------------------------------------------------------------- */

  async handleList(
    request: NextRequest,
    agencyId: string,
    opts: { pinnedInfluencerId?: string; stripSpend?: boolean } = {},
  ): Promise<NextResponse> {
    try {
      const sp = new URL(request.url).searchParams;
      const filter: Record<string, unknown> = {
        agencyId: new mongoose.Types.ObjectId(agencyId),
      };

      if (opts.pinnedInfluencerId) {
        // Influencer sessions: always scope to their own id regardless of query params.
        if (!mongoose.isValidObjectId(opts.pinnedInfluencerId)) {
          return NextResponse.json({ error: "Invalid pinnedInfluencerId" }, { status: 400 });
        }
        filter.influencerId = new mongoose.Types.ObjectId(opts.pinnedInfluencerId);
      } else {
        const influencerId = sp.get("influencerId");
        if (influencerId) {
          if (!mongoose.isValidObjectId(influencerId)) {
            return NextResponse.json({ error: "Invalid influencerId" }, { status: 400 });
          }
          filter.influencerId = new mongoose.Types.ObjectId(influencerId);
        }
      }

      const platform = sp.get("platform");
      if (platform) {
        if (!isValidPlatform(platform)) {
          return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
        }
        filter.platform = platform;
      }

      const weekKeys = sp.get("weekKeys");
      if (weekKeys) {
        const keys = weekKeys.split(",").map((k) => k.trim()).filter(Boolean);
        for (const k of keys) {
          if (!parseWeekKey(k)) {
            return NextResponse.json(
              { error: `Invalid weekKey: ${k}` },
              { status: 400 },
            );
          }
        }
        filter.weekKey = { $in: keys };
      }

      await connectMongo();
      const docs = await WeeklyEntryModel.find(filter).lean<WeeklyEntryDoc[]>();
      return NextResponse.json({ data: docs.map((d) => this.toJson(d, opts.stripSpend)) });
    } catch (err) {
      return this.errorResponse(err);
    }
  }

  async handleUpsert(
    request: NextRequest,
    agencyId: string,
  ): Promise<NextResponse> {
    try {
      const body = (await request.json()) as UpsertEntryBody;

      if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
      }
      if (!mongoose.isValidObjectId(body.influencerId)) {
        return NextResponse.json({ error: "Invalid influencerId" }, { status: 400 });
      }
      if (!isValidPlatform(body.platform)) {
        return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
      }
      if (!parseWeekKey(body.weekKey)) {
        return NextResponse.json(
          { error: "weekKey must look like 'YYYY-Www'" },
          { status: 400 },
        );
      }

      await connectMongo();
      if (!(await this.influencerInAgency(body.influencerId, agencyId))) {
        return NextResponse.json(
          { error: "Influencer does not belong to the active agency" },
          { status: 404 },
        );
      }

      const validation = validateEntryData(body.platform, body.data);
      if (validation.ok === false) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      const agencyObjId = new mongoose.Types.ObjectId(agencyId);
      const doc = await WeeklyEntryModel.findOneAndUpdate(
        {
          influencerId: new mongoose.Types.ObjectId(body.influencerId),
          platform: body.platform,
          weekKey: body.weekKey,
        },
        {
          $set: { data: validation.data },
          $setOnInsert: { agencyId: agencyObjId },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      ).lean<WeeklyEntryDoc>();

      if (!doc) {
        return NextResponse.json({ error: "Upsert failed" }, { status: 500 });
      }
      return NextResponse.json({ data: this.toJson(doc) });
    } catch (err) {
      return this.errorResponse(err, 400);
    }
  }

  async handleDelete(
    request: NextRequest,
    agencyId: string,
  ): Promise<NextResponse> {
    try {
      const sp = new URL(request.url).searchParams;
      const influencerId = sp.get("influencerId");
      const platform = sp.get("platform");
      const weekKey = sp.get("weekKey");

      if (!influencerId || !platform || !weekKey) {
        return NextResponse.json(
          { error: "influencerId, platform, weekKey are all required" },
          { status: 400 },
        );
      }
      if (!mongoose.isValidObjectId(influencerId) || !isValidPlatform(platform) || !parseWeekKey(weekKey)) {
        return NextResponse.json({ error: "Invalid params" }, { status: 400 });
      }

      await connectMongo();
      const res = await WeeklyEntryModel.findOneAndDelete({
        agencyId: new mongoose.Types.ObjectId(agencyId),
        influencerId: new mongoose.Types.ObjectId(influencerId),
        platform,
        weekKey,
      });
      if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (err) {
      return this.errorResponse(err);
    }
  }
}

export const entriesController = new EntriesController();
