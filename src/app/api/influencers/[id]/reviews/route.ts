import "server-only";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongo } from "@/lib/db/mongo";
import { InfluencerReviewModel } from "@/app/api/influencers/reviews.model";
import { resolveAgencyContext } from "@/lib/tenancy/server";
import { requireDataEntry } from "@/lib/auth/guards";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/influencers/[id]/reviews
 * List reviews for an influencer. Accessible to all authenticated roles
 * (admins/editors viewing, influencer viewing their own).
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const ctx = await resolveAgencyContext(request);
  if (ctx instanceof NextResponse) return ctx;

  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // Influencer sessions may only fetch their own reviews.
  if (ctx.role === "influencer" && ctx.influencerId !== id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectMongo();
  const reviews = await InfluencerReviewModel.find({
    influencerId: new mongoose.Types.ObjectId(id),
    agencyId: new mongoose.Types.ObjectId(ctx.agencyId),
  })
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({
    data: reviews.map((r) => ({
      _id: r._id.toString(),
      authorName: r.authorName,
      content: r.content,
      weekKey: r.weekKey ?? null,
      rating: r.rating ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

/**
 * POST /api/influencers/[id]/reviews
 * Create a review. Admin/editor only.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;

  const denied = await requireDataEntry(request);
  if (denied) return denied;

  const ctx = await resolveAgencyContext(request);
  if (ctx instanceof NextResponse) return ctx;

  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: { content?: string; weekKey?: string; rating?: number; authorName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const content = body.content?.trim();
  if (!content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  // Use session username as author name if not provided in body.
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(sessionToken);
  const authorName = body.authorName?.trim() || session?.sub || "Team";
  const weekKey = body.weekKey?.trim() || null;
  const rating =
    typeof body.rating === "number" && body.rating >= 1 && body.rating <= 5
      ? Math.round(body.rating)
      : null;

  await connectMongo();
  const doc = await InfluencerReviewModel.create({
    agencyId: new mongoose.Types.ObjectId(ctx.agencyId),
    influencerId: new mongoose.Types.ObjectId(id),
    authorName,
    content,
    weekKey,
    rating,
  });

  return NextResponse.json(
    {
      data: {
        _id: doc._id.toString(),
        authorName: doc.authorName,
        content: doc.content,
        weekKey: doc.weekKey ?? null,
        rating: doc.rating ?? null,
        createdAt: doc.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
