import "server-only";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongo } from "@/lib/db/mongo";
import { InfluencerModel } from "@/app/api/influencers/influencers.model";
import { resolveAgencyContext } from "@/lib/tenancy/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INFLOWW_BASE = "https://openapi.infloww.com";

/**
 * GET /api/infloww/subscribers?influencerId=<id>
 *
 * Fetches the OnlyFans subscriber count for a given influencer from Infloww
 * by summing subCount across all TRACKING links for that creator.
 *
 * Requires INFLOW_API_KEY and INFLOW_AGENCY_OID env vars.
 */
export async function GET(request: NextRequest) {
  const ctx = await resolveAgencyContext(request);
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(request.url);
  const influencerId = searchParams.get("influencerId");

  if (!influencerId || !mongoose.isValidObjectId(influencerId)) {
    return NextResponse.json({ error: "influencerId is required" }, { status: 400 });
  }

  const apiKey = process.env.INFLOW_API_KEY;
  const agencyOid = process.env.INFLOW_AGENCY_OID;

  if (!apiKey || !agencyOid) {
    return NextResponse.json(
      { error: "Infloww API credentials not configured (INFLOW_API_KEY / INFLOW_AGENCY_OID)" },
      { status: 503 },
    );
  }

  await connectMongo();

  const influencer = await InfluencerModel.findOne({
    _id: influencerId,
    agencyId: new mongoose.Types.ObjectId(ctx.agencyId),
  }).lean();

  if (!influencer) {
    return NextResponse.json({ error: "Influencer not found" }, { status: 404 });
  }

  const inflowwCreatorId = influencer.inflowwCreatorId;
  if (!inflowwCreatorId) {
    return NextResponse.json(
      { error: "No Infloww creator ID linked to this influencer" },
      { status: 422 },
    );
  }

  // Fetch all tracking links for this creator and sum subCount.
  let totalSubscribers = 0;
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({
      creatorId: inflowwCreatorId,
      linkType: "TRACKING",
      platformCode: "OnlyFans",
      limit: "100",
    });
    if (cursor) params.set("cursor", cursor);

    const res = await fetch(`${INFLOWW_BASE}/v1/links?${params.toString()}`, {
      headers: {
        Authorization: apiKey,
        "x-oid": agencyOid,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: `Infloww API error ${res.status}: ${body}` },
        { status: 502 },
      );
    }

    const json = await res.json();
    const list: { subCount?: number }[] = json?.data?.list ?? [];
    for (const link of list) {
      if (typeof link.subCount === "number") {
        totalSubscribers += link.subCount;
      }
    }

    hasMore = Boolean(json.hasMore);
    cursor = json.cursor ?? null;
    if (!cursor) hasMore = false;
  }

  return NextResponse.json({ subscribers: totalSubscribers });
}
