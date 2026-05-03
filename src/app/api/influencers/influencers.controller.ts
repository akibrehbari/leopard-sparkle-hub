/**
 * Influencers controller.
 *
 * Owns all CRUD on the influencers collection plus the Infloww sync. Sync
 * upserts one document per Infloww creator (matched by inflowwCreatorId);
 * existing influencers keep their handles/edits intact.
 */
import "server-only";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongo } from "@/lib/db/mongo";
import { InfluencerModel, type InfluencerDoc } from "./influencers.model";
import type {
  CreateInfluencerBody,
  Influencer,
  SyncResult,
  UpdateInfluencerBody,
} from "@/lib/influencers/types";

/** The Infloww controller is in the sibling folder; we call it directly so we
 *  reuse its retry/auth logic instead of round-tripping HTTP to ourselves. */
import type { InflowwCreator, InflowwEnvelope } from "@/lib/infloww/types";

class InfluencersController {
  private toJson(doc: InfluencerDoc): Influencer {
    return {
      _id: doc._id.toString(),
      name: doc.name,
      inflowwCreatorId: doc.inflowwCreatorId ?? undefined,
      inflowwUserName: doc.inflowwUserName ?? undefined,
      handles: {
        reddit: doc.handles?.reddit ?? undefined,
        instagram: doc.handles?.instagram ?? undefined,
      },
      isManual: doc.isManual,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  private errorResponse(err: unknown, fallbackStatus = 500): NextResponse {
    if (err instanceof Error) {
      console.error("[influencers] error", err);
      return NextResponse.json({ error: err.message }, { status: fallbackStatus });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }

  /* ---------------------------------------------------------------------- */
  /*  Routes                                                                */
  /* ---------------------------------------------------------------------- */

  async handleList(_request: NextRequest): Promise<NextResponse> {
    try {
      await connectMongo();
      const docs = await InfluencerModel.find({}).sort({ name: 1 }).lean<InfluencerDoc[]>();
      return NextResponse.json({ data: docs.map((d) => this.toJson(d)) });
    } catch (err) {
      return this.errorResponse(err);
    }
  }

  async handleGet(_request: NextRequest, id: string): Promise<NextResponse> {
    try {
      if (!mongoose.isValidObjectId(id)) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
      }
      await connectMongo();
      const doc = await InfluencerModel.findById(id).lean<InfluencerDoc>();
      if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ data: this.toJson(doc) });
    } catch (err) {
      return this.errorResponse(err);
    }
  }

  async handleCreateManual(request: NextRequest): Promise<NextResponse> {
    try {
      const body = (await request.json()) as CreateInfluencerBody;
      const name = body?.name?.trim();
      if (!name) {
        return NextResponse.json(
          { error: "Name is required" },
          { status: 400 },
        );
      }
      await connectMongo();
      const doc = await InfluencerModel.create({
        name,
        isManual: true,
        handles: {
          reddit: body.handles?.reddit?.trim() || null,
          instagram: body.handles?.instagram?.trim() || null,
        },
      });
      return NextResponse.json({ data: this.toJson(doc.toObject() as InfluencerDoc) }, { status: 201 });
    } catch (err) {
      return this.errorResponse(err, 400);
    }
  }

  async handleUpdate(request: NextRequest, id: string): Promise<NextResponse> {
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
        update["handles.reddit"] = body.handles.reddit?.trim() || null;
        update["handles.instagram"] = body.handles.instagram?.trim() || null;
      }
      if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
      }
      await connectMongo();
      const doc = await InfluencerModel.findByIdAndUpdate(id, update, {
        new: true,
        runValidators: true,
      }).lean<InfluencerDoc>();
      if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ data: this.toJson(doc) });
    } catch (err) {
      return this.errorResponse(err, 400);
    }
  }

  async handleDelete(_request: NextRequest, id: string): Promise<NextResponse> {
    try {
      if (!mongoose.isValidObjectId(id)) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
      }
      await connectMongo();
      const res = await InfluencerModel.findByIdAndDelete(id);
      if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (err) {
      return this.errorResponse(err);
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Sync from Infloww                                                     */
  /* ---------------------------------------------------------------------- */

  async handleSync(_request: NextRequest): Promise<NextResponse> {
    try {
      const creators = await this.fetchAllInflowwCreators();

      await connectMongo();
      let created = 0;
      let updated = 0;

      for (const c of creators) {
        const existing = await InfluencerModel.findOne({ inflowwCreatorId: c.id });
        if (existing) {
          existing.name = c.nickName || c.name || existing.name;
          existing.inflowwUserName = c.userName ?? existing.inflowwUserName ?? null;
          await existing.save();
          updated += 1;
        } else {
          await InfluencerModel.create({
            name: c.nickName || c.name || c.userName || "Untitled",
            inflowwCreatorId: c.id,
            inflowwUserName: c.userName ?? null,
            isManual: false,
            handles: { reddit: null, instagram: null },
          });
          created += 1;
        }
      }

      const result: SyncResult = {
        fetched: creators.length,
        created,
        updated,
        total: created + updated,
      };
      return NextResponse.json({ data: result });
    } catch (err) {
      return this.errorResponse(err);
    }
  }

  /**
   * Walk the Infloww creator pages directly using the same pattern the
   * Infloww controller uses. We import dynamically to avoid creating an
   * import cycle and to keep the sibling controller's retry/auth logic
   * encapsulated.
   */
  private async fetchAllInflowwCreators(): Promise<InflowwCreator[]> {
    const { inflowwController } = await import(
      "@/app/api/infloww/infloww.controller"
    );

    const out: InflowwCreator[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 20; page += 1) {
      const url = new URL(
        cursor ? `http://x/?limit=100&cursor=${cursor}` : "http://x/?limit=100",
      );
      const fakeReq = { url: url.toString() } as NextRequest;
      const resp = await inflowwController.handleGetCreators(fakeReq);
      const json = (await resp.json()) as InflowwEnvelope<InflowwCreator>;
      if (!resp.ok) {
        throw new Error(
          (json as unknown as { error?: string })?.error ?? "Infloww sync failed",
        );
      }
      const list = json.data?.list ?? [];
      out.push(...list);
      if (!json.hasMore || !json.cursor) break;
      cursor = String(json.cursor);
    }
    return out;
  }
}

export const influencersController = new InfluencersController();
