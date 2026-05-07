/**
 * Influencers controller.
 *
 * Owns CRUD on the influencers collection. All influencers are created
 * manually; per-platform handles are pure strings the operator types in.
 *
 * Tenant-scoped: every read filters by `agencyId`, every write stamps it.
 * The route handler resolves the active agency via `resolveAgencyContext`
 * (cookie for admin/editor, JWT-bound for agency_owner) and passes it in.
 */
import "server-only";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectMongo } from "@/lib/db/mongo";
import { InfluencerModel, type InfluencerDoc } from "./influencers.model";
import { PLATFORM_KEYS } from "@/lib/platforms/registry";
import type {
  CreateInfluencerBody,
  Influencer,
  InfluencerHandles,
  UpdateInfluencerBody,
} from "@/lib/influencers/types";

class InfluencersController {
  private toJson(doc: InfluencerDoc): Influencer {
    const handles: InfluencerHandles = {};
    for (const key of PLATFORM_KEYS) {
      const v = doc.handles?.[key];
      if (v) handles[key] = v;
    }
    return {
      _id: doc._id.toString(),
      name: doc.name,
      handles,
      loginUsername: doc.loginUsername ?? null,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  /**
   * Sanitize an incoming `handles` map. Coerces empty / whitespace strings to
   * undefined and drops any unknown platform keys.
   */
  private sanitizeHandles(input: InfluencerHandles | undefined): Record<string, string | null> {
    const out: Record<string, string | null> = {};
    if (!input) return out;
    for (const key of PLATFORM_KEYS) {
      const raw = input[key];
      const trimmed = typeof raw === "string" ? raw.trim() : "";
      out[key] = trimmed.length > 0 ? trimmed : null;
    }
    return out;
  }

  private errorResponse(err: unknown, fallbackStatus = 500): NextResponse {
    if (err instanceof Error) {
      console.error("[influencers] error", err);
      return NextResponse.json({ error: err.message }, { status: fallbackStatus });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }

  /* ---------------------------------------------------------------------- */

  async handleList(
    _request: NextRequest,
    agencyId: string,
    influencerId?: string,
  ): Promise<NextResponse> {
    try {
      await connectMongo();
      const filter: Record<string, unknown> = {
        agencyId: new mongoose.Types.ObjectId(agencyId),
      };
      if (influencerId) {
        if (!mongoose.isValidObjectId(influencerId)) {
          return NextResponse.json({ error: "Invalid influencerId" }, { status: 400 });
        }
        filter._id = new mongoose.Types.ObjectId(influencerId);
      }
      const docs = await InfluencerModel.find(filter)
        .sort({ name: 1 })
        .lean<InfluencerDoc[]>();
      return NextResponse.json({ data: docs.map((d) => this.toJson(d)) });
    } catch (err) {
      return this.errorResponse(err);
    }
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
      const doc = await InfluencerModel.findOne({
        _id: id,
        agencyId: new mongoose.Types.ObjectId(agencyId),
      }).lean<InfluencerDoc>();
      if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ data: this.toJson(doc) });
    } catch (err) {
      return this.errorResponse(err);
    }
  }

  async handleCreate(
    request: NextRequest,
    agencyId: string,
  ): Promise<NextResponse> {
    try {
      const body = (await request.json()) as CreateInfluencerBody;
      const name = body?.name?.trim();
      if (!name) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }
      await connectMongo();
      const doc = await InfluencerModel.create({
        agencyId: new mongoose.Types.ObjectId(agencyId),
        name,
        handles: this.sanitizeHandles(body.handles),
      });
      return NextResponse.json(
        { data: this.toJson(doc.toObject() as InfluencerDoc) },
        { status: 201 },
      );
    } catch (err) {
      return this.errorResponse(err, 400);
    }
  }

  async handleUpdate(
    request: NextRequest,
    id: string,
    agencyId: string,
  ): Promise<NextResponse> {
    try {
      if (!mongoose.isValidObjectId(id)) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
      }
      const body = (await request.json()) as UpdateInfluencerBody;
      const update: Record<string, unknown> = {};
      if (typeof body.name === "string" && body.name.trim()) {
        update.name = body.name.trim();
      }
      if (body.handles) {
        const sanitized = this.sanitizeHandles(body.handles);
        for (const key of PLATFORM_KEYS) {
          update[`handles.${key}`] = sanitized[key] ?? null;
        }
      }
      if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
      }
      await connectMongo();
      // Scope the update by agencyId so a guess at another agency's
      // influencer id can't slip through as a 200.
      const doc = await InfluencerModel.findOneAndUpdate(
        { _id: id, agencyId: new mongoose.Types.ObjectId(agencyId) },
        update,
        { new: true, runValidators: true },
      ).lean<InfluencerDoc>();
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
      const res = await InfluencerModel.findOneAndDelete({
        _id: id,
        agencyId: new mongoose.Types.ObjectId(agencyId),
      });
      if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (err) {
      return this.errorResponse(err);
    }
  }

  /**
   * Set (or reset) the portal login credentials for a specific influencer.
   * Admin-only. Body: { loginUsername, loginPassword }.
   */
  async handleSetCredentials(
    request: NextRequest,
    id: string,
    agencyId: string,
  ): Promise<NextResponse> {
    try {
      if (!mongoose.isValidObjectId(id)) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
      }
      let body: { loginUsername?: string; loginPassword?: string };
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const loginUsername = body.loginUsername?.trim().toLowerCase();
      const loginPassword = body.loginPassword?.trim() || null;

      if (!loginUsername) {
        return NextResponse.json(
          { error: "loginUsername is required" },
          { status: 400 },
        );
      }

      await connectMongo();

      // Check uniqueness: ensure no other influencer has this username.
      const existing = await InfluencerModel.findOne({
        loginUsername,
        _id: { $ne: new mongoose.Types.ObjectId(id) },
      }).lean();
      if (existing) {
        return NextResponse.json(
          { error: "loginUsername is already taken" },
          { status: 409 },
        );
      }

      // If no password provided, keep the existing hash (username-only update).
      const update: Record<string, unknown> = { loginUsername };
      if (loginPassword) {
        update.loginPasswordHash = await bcrypt.hash(loginPassword, 10);
      } else {
        // Require password if no hash exists yet.
        const current = await InfluencerModel.findById(id).lean<InfluencerDoc>();
        if (!current?.loginPasswordHash) {
          return NextResponse.json(
            { error: "Password is required for first-time setup" },
            { status: 400 },
          );
        }
      }

      const doc = await InfluencerModel.findOneAndUpdate(
        { _id: id, agencyId: new mongoose.Types.ObjectId(agencyId) },
        { $set: update },
        { new: true, runValidators: true },
      ).lean<InfluencerDoc>();

      if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ data: this.toJson(doc) });
    } catch (err) {
      return this.errorResponse(err, 400);
    }
  }
}

export const influencersController = new InfluencersController();
