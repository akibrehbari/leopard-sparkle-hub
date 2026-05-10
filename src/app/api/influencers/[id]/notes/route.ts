import "server-only";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongo } from "@/lib/db/mongo";
import { InfluencerModel } from "../../influencers.model";
import { requireDataEntry } from "@/lib/auth/guards";
import { resolveAgencyContext } from "@/lib/tenancy/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHARS = 2000;

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/influencers/[id]/notes
 *
 * Save marketing and/or OF content notes for an influencer.
 * Accessible by admin, editor, and worker (data-entry roles).
 * These notes are internal — NOT returned to the influencer portal.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const denied = await requireDataEntry(request);
  if (denied) return denied;

  const ctx = await resolveAgencyContext(request);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: { marketingNotes?: string | null; ofNotes?: string | null; trackerNotes?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if ("marketingNotes" in body) {
    const v = body.marketingNotes;
    update.marketingNotes =
      typeof v === "string" && v.trim() ? v.slice(0, MAX_CHARS) : null;
  }
  if ("ofNotes" in body) {
    const v = body.ofNotes;
    update.ofNotes =
      typeof v === "string" && v.trim() ? v.slice(0, MAX_CHARS) : null;
  }
  if ("trackerNotes" in body) {
    const v = body.trackerNotes;
    update.trackerNotes =
      typeof v === "string" && v.trim() ? v.slice(0, 5000) : null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await connectMongo();
  const doc = await InfluencerModel.findOneAndUpdate(
    { _id: id, agencyId: new mongoose.Types.ObjectId(ctx.agencyId) },
    { $set: update },
    { new: true },
  ).lean();

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    data: {
      marketingNotes: (doc as { marketingNotes?: string | null }).marketingNotes ?? null,
      ofNotes: (doc as { ofNotes?: string | null }).ofNotes ?? null,
      trackerNotes: (doc as { trackerNotes?: string | null }).trackerNotes ?? null,
    },
  });
}
