/**
 * Subreddits controller.
 *
 * Owns CRUD on the `subreddits` collection plus manual weekly snapshot entry.
 * The list endpoint pre-joins the latest two snapshots so the UI table can
 * render followers + weekly delta in a single round-trip.
 *
 * Tenant-scoped: every read filters by `agencyId`, every write stamps it,
 * and the unique key on subreddit names is `(agencyId, name)` rather than
 * `name` alone — two different agencies can independently track the same
 * subreddit without colliding.
 */
import "server-only";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { connectMongo } from "@/lib/db/mongo";
import {
  SubredditModel,
  SubredditSnapshotModel,
  type SubredditDoc,
  type SubredditSnapshotDoc,
} from "./subreddits.model";
import { InfluencerModel } from "@/app/api/influencers/influencers.model";
import { normalizeSubredditName } from "@/lib/reddit/client";
import {
  SUBREDDIT_CATEGORY_KEYS,
  isValidCategory,
} from "@/lib/subreddits/categories";
import type {
  CreateSubredditBody,
  Subreddit,
  SubredditSnapshot,
  SubredditWithLatest,
  UpdateSubredditBody,
  UpsertSubredditSnapshotBody,
} from "@/lib/subreddits/types";

class SubredditsController {
  /* ---------------------------------------------------------------------- */
  /*  Serialization                                                         */
  /* ---------------------------------------------------------------------- */

  private toJson(doc: SubredditDoc): Subreddit {
    return {
      _id: doc._id.toString(),
      name: doc.name,
      displayName: doc.displayName ?? doc.name,
      category: doc.category,
      influencerId: doc.influencerId ? doc.influencerId.toString() : null,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  private snapshotToJson(doc: SubredditSnapshotDoc): SubredditSnapshot {
    return {
      _id: doc._id.toString(),
      subredditId: doc.subredditId.toString(),
      weekKey: doc.weekKey,
      followers: doc.followers,
      contributions: doc.contributions,
      weeklyVisits: doc.weeklyVisits,
    };
  }

  private errorResponse(err: unknown, fallbackStatus = 500): NextResponse {
    if (err instanceof Error) {
      console.error("[subreddits] error", err);
      return NextResponse.json({ error: err.message }, { status: fallbackStatus });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }

  /* ---------------------------------------------------------------------- */
  /*  List + lookup                                                         */
  /* ---------------------------------------------------------------------- */

  async handleList(
    _request: NextRequest,
    agencyId: string,
  ): Promise<NextResponse> {
    try {
      const data = await this.fetchListWithLatest({ agencyId });
      return NextResponse.json({ data });
    } catch (err) {
      return this.errorResponse(err);
    }
  }

  /**
   * List subreddits joined with their latest two snapshots and a computed
   * weekly delta. Reused by the share controller.
   *
   * `agencyId` is always required — there's no global, cross-tenant view.
   * `influencerIds` further narrows to subreddits owned by those influencers
   * (used by the share endpoint to materialize a share roster).
   */
  async fetchListWithLatest(filter: {
    agencyId: string;
    influencerIds?: string[];
  }): Promise<SubredditWithLatest[]> {
    if (!mongoose.isValidObjectId(filter.agencyId)) return [];
    await connectMongo();

    const query: Record<string, unknown> = {
      agencyId: new mongoose.Types.ObjectId(filter.agencyId),
    };
    if (filter.influencerIds) {
      const ids = filter.influencerIds
        .filter((id) => mongoose.isValidObjectId(id))
        .map((id) => new mongoose.Types.ObjectId(id));
      if (ids.length === 0) return [];
      query.influencerId = { $in: ids };
    }

    const subreddits = await SubredditModel.find(query)
      .sort({ name: 1 })
      .lean<SubredditDoc[]>();
    if (subreddits.length === 0) return [];

    const ids = subreddits.map((s) => s._id);
    const snaps = await SubredditSnapshotModel.aggregate<{
      _id: mongoose.Types.ObjectId;
      snapshots: SubredditSnapshotDoc[];
    }>([
      { $match: { subredditId: { $in: ids } } },
      { $sort: { subredditId: 1, weekKey: -1 } },
      {
        $group: {
          _id: "$subredditId",
          snapshots: { $push: "$$ROOT" },
        },
      },
      { $project: { snapshots: { $slice: ["$snapshots", 2] } } },
    ]);

    const byId = new Map(snaps.map((s) => [s._id.toString(), s.snapshots]));
    return subreddits.map((doc) => {
      const recent = byId.get(doc._id.toString()) ?? [];
      const latest = recent[0]
        ? this.snapshotToJson(recent[0] as unknown as SubredditSnapshotDoc)
        : null;
      const prior = recent[1]
        ? this.snapshotToJson(recent[1] as unknown as SubredditSnapshotDoc)
        : null;
      const weeklyDelta =
        latest && prior ? latest.followers - prior.followers : null;
      return {
        ...this.toJson(doc),
        latest,
        prior,
        weeklyDelta,
      };
    });
  }

  async handleGet(
    _request: NextRequest,
    id: string,
    agencyId: string,
  ): Promise<NextResponse> {
    try {
      if (!mongoose.isValidObjectId(id)) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
      }
      await connectMongo();
      const doc = await SubredditModel.findOne({
        _id: id,
        agencyId: new mongoose.Types.ObjectId(agencyId),
      }).lean<SubredditDoc>();
      if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ data: this.toJson(doc) });
    } catch (err) {
      return this.errorResponse(err);
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Create                                                                */
  /* ---------------------------------------------------------------------- */

  async handleCreate(
    request: NextRequest,
    agencyId: string,
  ): Promise<NextResponse> {
    try {
      const body = (await request.json()) as CreateSubredditBody;
      const name = normalizeSubredditName(body?.name ?? "");
      const category = (body?.category ?? "").trim().toLowerCase();
      if (!name) {
        return NextResponse.json({ error: "Subreddit name is required" }, { status: 400 });
      }
      if (!category) {
        return NextResponse.json({ error: "Category is required" }, { status: 400 });
      }
      if (!isValidCategory(category)) {
        return NextResponse.json(
          {
            error: `Invalid category "${category}". Allowed: ${SUBREDDIT_CATEGORY_KEYS.join(", ")}`,
          },
          { status: 400 },
        );
      }
      const agencyObjId = new mongoose.Types.ObjectId(agencyId);
      const influencerId = body.influencerId
        ? mongoose.isValidObjectId(body.influencerId)
          ? new mongoose.Types.ObjectId(body.influencerId)
          : null
        : null;
      if (body.influencerId && !influencerId) {
        return NextResponse.json({ error: "Invalid influencerId" }, { status: 400 });
      }

      await connectMongo();

      // Verify the linked influencer (if any) is in the same agency. Without
      // this check an admin could link a sub to an influencer in another
      // agency by hand-crafting the request.
      if (influencerId) {
        const exists = await InfluencerModel.exists({
          _id: influencerId,
          agencyId: agencyObjId,
        });
        if (!exists) {
          return NextResponse.json(
            { error: "Linked influencer does not exist in the active agency" },
            { status: 400 },
          );
        }
      }

      const existing = await SubredditModel.findOne({
        agencyId: agencyObjId,
        name,
      }).lean<SubredditDoc>();
      if (existing) {
        return NextResponse.json(
          { error: `r/${name} is already tracked in this agency` },
          { status: 409 },
        );
      }

      const doc = await SubredditModel.create({
        agencyId: agencyObjId,
        name,
        displayName: name,
        category,
        influencerId,
      });

      return NextResponse.json(
        { data: this.toJson(doc.toObject() as SubredditDoc) },
        { status: 201 },
      );
    } catch (err) {
      return this.errorResponse(err, 400);
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Update / delete                                                       */
  /* ---------------------------------------------------------------------- */

  async handleUpdate(
    request: NextRequest,
    id: string,
    agencyId: string,
  ): Promise<NextResponse> {
    try {
      if (!mongoose.isValidObjectId(id)) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
      }
      const body = (await request.json()) as UpdateSubredditBody;
      const update: Record<string, unknown> = {};
      const agencyObjId = new mongoose.Types.ObjectId(agencyId);

      if (typeof body.category === "string" && body.category.trim()) {
        const cat = body.category.trim().toLowerCase();
        if (!isValidCategory(cat)) {
          return NextResponse.json(
            {
              error: `Invalid category "${cat}". Allowed: ${SUBREDDIT_CATEGORY_KEYS.join(", ")}`,
            },
            { status: 400 },
          );
        }
        update.category = cat;
      }
      if ("influencerId" in body) {
        if (body.influencerId === null || body.influencerId === undefined) {
          update.influencerId = null;
        } else if (mongoose.isValidObjectId(body.influencerId)) {
          // Verify same-agency ownership before re-pointing the link.
          await connectMongo();
          const exists = await InfluencerModel.exists({
            _id: body.influencerId,
            agencyId: agencyObjId,
          });
          if (!exists) {
            return NextResponse.json(
              { error: "Linked influencer does not exist in the active agency" },
              { status: 400 },
            );
          }
          update.influencerId = new mongoose.Types.ObjectId(body.influencerId);
        } else {
          return NextResponse.json({ error: "Invalid influencerId" }, { status: 400 });
        }
      }
      if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
      }

      await connectMongo();
      const doc = await SubredditModel.findOneAndUpdate(
        { _id: id, agencyId: agencyObjId },
        update,
        { new: true, runValidators: true },
      ).lean<SubredditDoc>();
      if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ data: this.toJson(doc) });
    } catch (err) {
      return this.errorResponse(err, 400);
    }
  }

  async handleDelete(
    _request: NextRequest,
    id: string,
    agencyId: string,
  ): Promise<NextResponse> {
    try {
      if (!mongoose.isValidObjectId(id)) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
      }
      await connectMongo();
      const doc = await SubredditModel.findOneAndDelete({
        _id: id,
        agencyId: new mongoose.Types.ObjectId(agencyId),
      });
      if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
      // Snapshots are intentionally retained — they're cheap and useful for
      // historical comparisons should the operator re-add the same subreddit.
      return NextResponse.json({ ok: true });
    } catch (err) {
      return this.errorResponse(err);
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Manual snapshot entry                                                 */
  /* ---------------------------------------------------------------------- */

  /**
   * Upsert a weekly snapshot for a single subreddit.
   * Called from PATCH /api/subreddits/snapshots with manager-level auth.
   */
  async handleUpsertSnapshot(
    request: NextRequest,
    agencyId: string,
  ): Promise<NextResponse> {
    try {
      const body = (await request.json()) as UpsertSubredditSnapshotBody;
      const { subredditId, weekKey, followers, contributions, weeklyVisits } = body ?? {};

      if (!subredditId || !mongoose.isValidObjectId(subredditId)) {
        return NextResponse.json({ error: "Invalid subredditId" }, { status: 400 });
      }
      if (!weekKey || !/^\d{4}-W\d{2}$/.test(weekKey)) {
        return NextResponse.json({ error: "weekKey must match YYYY-Www" }, { status: 400 });
      }
      if (typeof followers !== "number" || followers < 0) {
        return NextResponse.json({ error: "followers must be a non-negative number" }, { status: 400 });
      }
      if (typeof contributions !== "number" || contributions < 0) {
        return NextResponse.json({ error: "contributions must be a non-negative number" }, { status: 400 });
      }
      if (typeof weeklyVisits !== "number" || weeklyVisits < 0) {
        return NextResponse.json({ error: "weeklyVisits must be a non-negative number" }, { status: 400 });
      }

      await connectMongo();
      const agencyObjId = new mongoose.Types.ObjectId(agencyId);
      const subredditObjId = new mongoose.Types.ObjectId(subredditId);

      // Verify the subreddit belongs to this agency.
      const sub = await SubredditModel.findOne({
        _id: subredditObjId,
        agencyId: agencyObjId,
      }).lean<SubredditDoc>();
      if (!sub) {
        return NextResponse.json({ error: "Subreddit not found" }, { status: 404 });
      }

      const snap = await SubredditSnapshotModel.findOneAndUpdate(
        { subredditId: subredditObjId, weekKey },
        {
          $set: { followers, contributions, weeklyVisits },
          $setOnInsert: {
            subredditId: subredditObjId,
            agencyId: agencyObjId,
            weekKey,
          },
        },
        { upsert: true, new: true },
      ).lean<SubredditSnapshotDoc>();

      return NextResponse.json({ data: this.snapshotToJson(snap!) });
    } catch (err) {
      return this.errorResponse(err, 400);
    }
  }
}

export const subredditsController = new SubredditsController();
