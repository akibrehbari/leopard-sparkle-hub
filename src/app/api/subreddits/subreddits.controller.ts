/**
 * Subreddits controller.
 *
 * Owns CRUD on the `subreddits` collection plus the Sunday sync that hits
 * Reddit's public JSON API and writes per-week snapshots to
 * `subreddit_snapshots`. The list endpoint also pre-joins the latest two
 * snapshots so the UI table can render subscribers + weekly delta in a
 * single round-trip.
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
  type SubredditTopPost,
} from "./subreddits.model";
import { InfluencerModel } from "@/app/api/influencers/influencers.model";
import {
  fetchSubredditAbout,
  fetchSubredditDigest,
  normalizeSubredditName,
} from "@/lib/reddit/client";
import {
  SUBREDDIT_CATEGORY_KEYS,
  isValidCategory,
} from "@/lib/subreddits/categories";
import { currentWeekKey } from "@/lib/utils/week";
import type {
  CreateSubredditBody,
  Subreddit,
  SubredditSnapshot,
  SubredditTopPost as SubredditTopPostJson,
  SubredditWithLatest,
  SyncResult,
  UpdateSubredditBody,
} from "@/lib/subreddits/types";

/** Cap concurrent Reddit fetches during a sync run. Reddit rate-limits ~60/min. */
const SYNC_BATCH_SIZE = 5;

class SubredditsController {
  /* ---------------------------------------------------------------------- */
  /*  Serialization                                                         */
  /* ---------------------------------------------------------------------- */

  private toJson(doc: SubredditDoc): Subreddit {
    return {
      _id: doc._id.toString(),
      name: doc.name,
      displayName: doc.displayName,
      category: doc.category,
      influencerId: doc.influencerId ? doc.influencerId.toString() : null,
      description: doc.description,
      over18: doc.over18,
      lastSyncedAt: doc.lastSyncedAt ? doc.lastSyncedAt.toISOString() : null,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  private snapshotToJson(doc: SubredditSnapshotDoc): SubredditSnapshot {
    return {
      _id: doc._id.toString(),
      subredditId: doc.subredditId.toString(),
      weekKey: doc.weekKey,
      subscribers: doc.subscribers,
      activeUsers: doc.activeUsers,
      postsLast7d: doc.postsLast7d,
      topPost: doc.topPost as SubredditTopPostJson | null,
      syncedAt: doc.syncedAt.toISOString(),
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
        latest && prior ? latest.subscribers - prior.subscribers : null;
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

      // Validate the subreddit exists on Reddit. We tolerate a transient
      // Reddit failure by falling back to the operator-supplied name — better
      // to let them save and rely on the sync to reconcile than to block on a
      // flaky upstream.
      let displayName = name;
      let description: string | null = null;
      let over18 = false;
      try {
        const about = await fetchSubredditAbout(name);
        if (about) {
          displayName = about.display_name ?? name;
          description = about.public_description ?? null;
          over18 = Boolean(about.over18);
        } else {
          return NextResponse.json(
            { error: `r/${name} doesn't exist or isn't visible to anonymous users` },
            { status: 400 },
          );
        }
      } catch (err) {
        console.warn(
          "[subreddits] Reddit validation failed, accepting subreddit anyway",
          err,
        );
      }

      const doc = await SubredditModel.create({
        agencyId: agencyObjId,
        name,
        displayName,
        category,
        influencerId,
        description,
        over18,
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
  /*  Sync                                                                  */
  /* ---------------------------------------------------------------------- */

  /**
   * Sync one subreddit: fetch a digest from Reddit, upsert the snapshot for
   * the current PKT week, refresh cached metadata on the parent doc.
   *
   * Returns null on Reddit-side failure or if the subreddit isn't visible.
   */
  private async syncOne(
    doc: SubredditDoc,
    weekKey: string,
    now: Date,
  ): Promise<SubredditSnapshotDoc | null> {
    const digest = await fetchSubredditDigest(doc.name, now);
    if (!digest) return null;

    const topPost: SubredditTopPost | null = digest.topPost
      ? {
          title: digest.topPost.title,
          score: digest.topPost.score,
          url: digest.topPost.url,
          permalink: digest.topPost.permalink,
          author: digest.topPost.author,
        }
      : null;

    const snap = await SubredditSnapshotModel.findOneAndUpdate(
      { subredditId: doc._id, weekKey },
      {
        $set: {
          subscribers: digest.subscribers,
          activeUsers: digest.activeUsers,
          postsLast7d: digest.postsLast7d,
          topPost,
          syncedAt: now,
        },
        $setOnInsert: {
          subredditId: doc._id,
          agencyId: doc.agencyId,
          weekKey,
        },
      },
      { upsert: true, new: true },
    ).lean<SubredditSnapshotDoc>();

    await SubredditModel.findByIdAndUpdate(doc._id, {
      displayName: digest.meta.displayName,
      description: digest.meta.description,
      over18: digest.meta.over18,
      lastSyncedAt: now,
    });

    return snap;
  }

  async handleSyncAll(
    _request: NextRequest,
    agencyId: string,
  ): Promise<NextResponse> {
    try {
      await connectMongo();
      const docs = await SubredditModel.find({
        agencyId: new mongoose.Types.ObjectId(agencyId),
      }).lean<SubredditDoc[]>();
      const result = await this.runSync(docs);
      return NextResponse.json({ data: result });
    } catch (err) {
      return this.errorResponse(err);
    }
  }

  async handleSyncOne(
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
      const result = await this.runSync([doc]);
      return NextResponse.json({ data: result });
    } catch (err) {
      return this.errorResponse(err);
    }
  }

  /**
   * Run a sync over a list of subreddit docs in batches of SYNC_BATCH_SIZE,
   * using Promise.allSettled so a single bad subreddit doesn't sink the run.
   */
  private async runSync(docs: SubredditDoc[]): Promise<SyncResult> {
    const now = new Date();
    const weekKey = currentWeekKey();
    const failed: SyncResult["failed"] = [];
    let synced = 0;

    for (let i = 0; i < docs.length; i += SYNC_BATCH_SIZE) {
      const batch = docs.slice(i, i + SYNC_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((d) => this.syncOne(d, weekKey, now)),
      );
      results.forEach((r, idx) => {
        const doc = batch[idx];
        if (r.status === "fulfilled" && r.value) {
          synced += 1;
        } else if (r.status === "fulfilled" && !r.value) {
          failed.push({
            name: doc.name,
            error: "Subreddit not reachable on Reddit (private, banned, or deleted)",
          });
        } else if (r.status === "rejected") {
          failed.push({
            name: doc.name,
            error: (r.reason as Error)?.message ?? String(r.reason),
          });
        }
      });
    }

    return {
      total: docs.length,
      synced,
      failed,
      weekKey,
      syncedAt: now.toISOString(),
    };
  }
}

export const subredditsController = new SubredditsController();
