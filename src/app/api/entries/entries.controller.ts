/**
 * Weekly-entries controller.
 *
 * Operations:
 *   - List with filters (influencerId / platform / weekKeys). The tracker
 *     grid uses this to prefetch all visible cells in one round-trip.
 *   - Get one (influencerId + platform + weekKey) — used to prefill the form.
 *   - Upsert — idempotent create-or-update keyed on the unique compound index.
 *   - Delete — clears a single (influencer, platform, week) entry.
 */
import "server-only";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongo } from "@/lib/db/mongo";
import { WeeklyEntryModel, type WeeklyEntryDoc } from "./entries.model";
import {
  isValidPlatform,
  validateEntryData,
  type PlatformKey,
} from "@/lib/platforms/registry";
import { parseWeekKey } from "@/lib/utils/week";
import type { UpsertEntryBody, WeeklyEntry } from "@/lib/entries/types";

class EntriesController {
  private toJson(doc: WeeklyEntryDoc): WeeklyEntry {
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

  private errorResponse(err: unknown, fallbackStatus = 500): NextResponse {
    if (err instanceof Error) {
      console.error("[entries] error", err);
      return NextResponse.json({ error: err.message }, { status: fallbackStatus });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }

  /* ---------------------------------------------------------------------- */

  async handleList(request: NextRequest): Promise<NextResponse> {
    try {
      const sp = new URL(request.url).searchParams;
      const filter: Record<string, unknown> = {};

      const influencerId = sp.get("influencerId");
      if (influencerId) {
        if (!mongoose.isValidObjectId(influencerId)) {
          return NextResponse.json({ error: "Invalid influencerId" }, { status: 400 });
        }
        filter.influencerId = new mongoose.Types.ObjectId(influencerId);
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
      return NextResponse.json({ data: docs.map((d) => this.toJson(d)) });
    } catch (err) {
      return this.errorResponse(err);
    }
  }

  async handleUpsert(request: NextRequest): Promise<NextResponse> {
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

      const validation = validateEntryData(body.platform, body.data);
      if (validation.ok === false) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      await connectMongo();
      const doc = await WeeklyEntryModel.findOneAndUpdate(
        {
          influencerId: new mongoose.Types.ObjectId(body.influencerId),
          platform: body.platform,
          weekKey: body.weekKey,
        },
        { $set: { data: validation.data } },
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

  async handleDelete(request: NextRequest): Promise<NextResponse> {
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
