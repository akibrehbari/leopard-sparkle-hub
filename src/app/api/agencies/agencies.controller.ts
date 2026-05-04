/**
 * Agencies controller.
 *
 * Owns CRUD on the `agencies` collection. Admin-only mutations; the list
 * endpoint is gated by the route handler too (we never expose other
 * agencies to an agency owner).
 *
 * Delete is a hard cascade: we drop every record across `influencers`,
 * `weekly_entries`, `subreddits`, `subreddit_snapshots` that points at the
 * agency, then delete the agency itself. We require the caller to echo the
 * agency name back in the request body as a guard against accidental
 * tabbed-into-Postman deletes.
 */
import "server-only";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import { connectMongo } from "@/lib/db/mongo";
import { AgencyModel, type AgencyDoc } from "./agencies.model";
import { InfluencerModel } from "@/app/api/influencers/influencers.model";
import { WeeklyEntryModel } from "@/app/api/entries/entries.model";
import {
  SubredditModel,
  SubredditSnapshotModel,
} from "@/app/api/subreddits/subreddits.model";
import type {
  Agency,
  AgencySummary,
  CreateAgencyBody,
  UpdateAgencyBody,
} from "@/lib/agencies/types";
import { getSessionRole } from "@/lib/tenancy/server";

const BCRYPT_COST = 10;
const USERNAME_REGEX = /^[a-z0-9_.-]{3,64}$/;
const PASSWORD_MIN_LENGTH = 8;

class AgenciesController {
  /* ---------------------------------------------------------------------- */
  /*  Serialization                                                         */
  /* ---------------------------------------------------------------------- */

  private toJson(doc: AgencyDoc, counts?: Agency["counts"]): Agency {
    return {
      _id: doc._id.toString(),
      name: doc.name,
      ownerUsername: doc.ownerUsername,
      ...(counts ? { counts } : {}),
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  private toSummary(doc: AgencyDoc): AgencySummary {
    return { _id: doc._id.toString(), name: doc.name };
  }

  private errorResponse(err: unknown, fallbackStatus = 500): NextResponse {
    if (err instanceof Error) {
      console.error("[agencies] error", err);
      return NextResponse.json({ error: err.message }, { status: fallbackStatus });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }

  /* ---------------------------------------------------------------------- */
  /*  List                                                                  */
  /* ---------------------------------------------------------------------- */

  /**
   * Detailed list (admin only). Joins counts of influencers / subreddits /
   * weekly_entries per agency in a single aggregation so the management
   * table doesn't N+1.
   */
  async handleList(_request: NextRequest): Promise<NextResponse> {
    try {
      await connectMongo();
      const docs = await AgencyModel.find({}).sort({ name: 1 }).lean<AgencyDoc[]>();
      if (docs.length === 0) return NextResponse.json({ data: [] });

      const ids = docs.map((d) => d._id);
      const [influencerCounts, subredditCounts, entryCounts] = await Promise.all([
        InfluencerModel.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
          { $match: { agencyId: { $in: ids } } },
          { $group: { _id: "$agencyId", n: { $sum: 1 } } },
        ]),
        SubredditModel.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
          { $match: { agencyId: { $in: ids } } },
          { $group: { _id: "$agencyId", n: { $sum: 1 } } },
        ]),
        WeeklyEntryModel.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
          { $match: { agencyId: { $in: ids } } },
          { $group: { _id: "$agencyId", n: { $sum: 1 } } },
        ]),
      ]);

      const inf = new Map(influencerCounts.map((c) => [c._id.toString(), c.n]));
      const sub = new Map(subredditCounts.map((c) => [c._id.toString(), c.n]));
      const ent = new Map(entryCounts.map((c) => [c._id.toString(), c.n]));

      return NextResponse.json({
        data: docs.map((d) =>
          this.toJson(d, {
            influencers: inf.get(d._id.toString()) ?? 0,
            subreddits: sub.get(d._id.toString()) ?? 0,
            weeklyEntries: ent.get(d._id.toString()) ?? 0,
          }),
        ),
      });
    } catch (err) {
      return this.errorResponse(err);
    }
  }

  /**
   * Lightweight summary list for the active-agency switcher. Visible to all
   * authenticated users — but agency owners only see THEIR own agency.
   */
  async handleListSummaries(request: NextRequest): Promise<NextResponse> {
    try {
      const session = await getSessionRole(request);
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      await connectMongo();

      if (session.role === "agency_owner") {
        if (!session.agencyId) return NextResponse.json({ data: [] });
        const doc = await AgencyModel.findById(session.agencyId).lean<AgencyDoc>();
        return NextResponse.json({ data: doc ? [this.toSummary(doc)] : [] });
      }

      const docs = await AgencyModel.find({}).sort({ name: 1 }).lean<AgencyDoc[]>();
      return NextResponse.json({ data: docs.map((d) => this.toSummary(d)) });
    } catch (err) {
      return this.errorResponse(err);
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Create                                                                */
  /* ---------------------------------------------------------------------- */

  async handleCreate(request: NextRequest): Promise<NextResponse> {
    try {
      const body = (await request.json()) as CreateAgencyBody;
      const name = body?.name?.trim();
      const ownerUsername = body?.ownerUsername?.trim().toLowerCase();
      const ownerPassword = body?.ownerPassword;

      if (!name) {
        return NextResponse.json({ error: "Agency name is required" }, { status: 400 });
      }
      if (!ownerUsername || !USERNAME_REGEX.test(ownerUsername)) {
        return NextResponse.json(
          {
            error:
              "Owner username must be 3-64 chars of lowercase letters, digits, '.', '_' or '-'",
          },
          { status: 400 },
        );
      }
      if (!ownerPassword || ownerPassword.length < PASSWORD_MIN_LENGTH) {
        return NextResponse.json(
          { error: `Owner password must be at least ${PASSWORD_MIN_LENGTH} characters` },
          { status: 400 },
        );
      }
      if (this.collidesWithEnvCredentials(ownerUsername)) {
        return NextResponse.json(
          { error: "That username is reserved by an env credential" },
          { status: 409 },
        );
      }

      await connectMongo();
      const ownerPasswordHash = await bcrypt.hash(ownerPassword, BCRYPT_COST);

      let doc: AgencyDoc;
      try {
        doc = (await AgencyModel.create({
          name,
          ownerUsername,
          ownerPasswordHash,
        })).toObject() as AgencyDoc;
      } catch (err) {
        if (this.isDuplicateKeyError(err)) {
          return NextResponse.json(
            { error: "An agency with that name or owner username already exists" },
            { status: 409 },
          );
        }
        throw err;
      }

      return NextResponse.json(
        {
          data: this.toJson(doc, {
            influencers: 0,
            subreddits: 0,
            weeklyEntries: 0,
          }),
        },
        { status: 201 },
      );
    } catch (err) {
      return this.errorResponse(err, 400);
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Update                                                                */
  /* ---------------------------------------------------------------------- */

  async handleUpdate(request: NextRequest, id: string): Promise<NextResponse> {
    try {
      if (!mongoose.isValidObjectId(id)) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
      }
      const body = (await request.json()) as UpdateAgencyBody;
      const update: Record<string, unknown> = {};

      if (typeof body.name === "string" && body.name.trim()) {
        update.name = body.name.trim();
      }
      if (typeof body.ownerUsername === "string" && body.ownerUsername.trim()) {
        const u = body.ownerUsername.trim().toLowerCase();
        if (!USERNAME_REGEX.test(u)) {
          return NextResponse.json(
            { error: "Owner username has invalid format" },
            { status: 400 },
          );
        }
        if (this.collidesWithEnvCredentials(u)) {
          return NextResponse.json(
            { error: "That username is reserved by an env credential" },
            { status: 409 },
          );
        }
        update.ownerUsername = u;
      }
      if (typeof body.ownerPassword === "string" && body.ownerPassword.length > 0) {
        if (body.ownerPassword.length < PASSWORD_MIN_LENGTH) {
          return NextResponse.json(
            { error: `Owner password must be at least ${PASSWORD_MIN_LENGTH} characters` },
            { status: 400 },
          );
        }
        update.ownerPasswordHash = await bcrypt.hash(body.ownerPassword, BCRYPT_COST);
      }
      if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
      }

      await connectMongo();
      let doc: AgencyDoc | null;
      try {
        doc = await AgencyModel.findByIdAndUpdate(id, update, {
          new: true,
          runValidators: true,
        }).lean<AgencyDoc>();
      } catch (err) {
        if (this.isDuplicateKeyError(err)) {
          return NextResponse.json(
            { error: "An agency with that name or owner username already exists" },
            { status: 409 },
          );
        }
        throw err;
      }
      if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ data: this.toJson(doc) });
    } catch (err) {
      return this.errorResponse(err, 400);
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Delete (cascade)                                                      */
  /* ---------------------------------------------------------------------- */

  async handleDelete(request: NextRequest, id: string): Promise<NextResponse> {
    try {
      if (!mongoose.isValidObjectId(id)) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
      }
      let body: { confirmName?: string } = {};
      try {
        body = (await request.json()) as { confirmName?: string };
      } catch {
        // empty body — also rejected below
      }

      await connectMongo();
      const agency = await AgencyModel.findById(id).lean<AgencyDoc>();
      if (!agency) return NextResponse.json({ error: "Not found" }, { status: 404 });

      const provided = (body.confirmName ?? "").trim();
      if (provided.toLowerCase() !== agency.name.trim().toLowerCase()) {
        return NextResponse.json(
          {
            error:
              "Cascade delete requires confirmName to exactly match the agency name",
          },
          { status: 400 },
        );
      }

      const agencyId = agency._id;
      // Cascade across every tenant-scoped collection. We do them in
      // dependency-friendly order (children before parent) so an early
      // failure leaves the agency itself intact and the operator can retry.
      const [entriesRes, subSnapsRes, subRes, infRes] = await Promise.all([
        WeeklyEntryModel.deleteMany({ agencyId }),
        SubredditSnapshotModel.deleteMany({ agencyId }),
        SubredditModel.deleteMany({ agencyId }),
        InfluencerModel.deleteMany({ agencyId }),
      ]);
      await AgencyModel.deleteOne({ _id: agencyId });

      return NextResponse.json({
        ok: true,
        cascaded: {
          weeklyEntries: entriesRes.deletedCount ?? 0,
          subredditSnapshots: subSnapsRes.deletedCount ?? 0,
          subreddits: subRes.deletedCount ?? 0,
          influencers: infRes.deletedCount ?? 0,
        },
      });
    } catch (err) {
      return this.errorResponse(err);
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Active-agency selection                                               */
  /* ---------------------------------------------------------------------- */

  /**
   * Validate that `agencyId` exists. The route handler writes the cookie;
   * this just exists so we don't trust the client to set it for an
   * unknown id.
   */
  async assertAgencyExists(agencyId: string): Promise<boolean> {
    if (!mongoose.isValidObjectId(agencyId)) return false;
    await connectMongo();
    const exists = await AgencyModel.exists({ _id: agencyId });
    return Boolean(exists);
  }

  /* ---------------------------------------------------------------------- */
  /*  Helpers                                                               */
  /* ---------------------------------------------------------------------- */

  /**
   * Prevent agency owner usernames from colliding with admin/editor env
   * credentials — which would silently make the env credential unreachable
   * because env is checked first.
   */
  private collidesWithEnvCredentials(username: string): boolean {
    const adminUser = process.env.ADMIN_USERNAME?.trim().toLowerCase();
    const editorUser = process.env.EDITOR_USERNAME?.trim().toLowerCase();
    if (adminUser && username === adminUser) return true;
    if (editorUser && username === editorUser) return true;
    return false;
  }

  private isDuplicateKeyError(err: unknown): boolean {
    return (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: number }).code === 11000
    );
  }
}

export const agenciesController = new AgenciesController();
