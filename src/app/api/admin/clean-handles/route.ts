/**
 * POST /api/admin/clean-handles
 * One-shot utility: sets any empty-string handle to null for all influencers.
 * Admin only. Safe to call multiple times (idempotent).
 */
import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireAdmin } from "@/lib/auth/guards";
import { InfluencerModel } from "@/app/api/influencers/influencers.model";

const PLATFORM_KEYS = ["reddit", "instagram", "x", "onlyfans"] as const;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  await connectMongo();

  const influencers = await InfluencerModel.find({}).lean();
  const results: { name: string; cleared: string[] }[] = [];

  for (const inf of influencers) {
    const cleared: string[] = [];
    const update: Record<string, null> = {};

    for (const key of PLATFORM_KEYS) {
      const val = inf.handles?.[key as keyof typeof inf.handles];
      if (typeof val === "string" && val.trim() === "") {
        update[`handles.${key}`] = null;
        cleared.push(key);
      }
    }

    if (Object.keys(update).length > 0) {
      await InfluencerModel.updateOne({ _id: inf._id }, { $set: update });
      results.push({ name: inf.name, cleared });
    }
  }

  return NextResponse.json({
    ok: true,
    total: influencers.length,
    updated: results.length,
    details: results,
  });
}
