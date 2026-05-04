import { NextRequest, NextResponse } from "next/server";
import { subredditsController } from "../subreddits.controller";
import { requireEditorOrAdmin } from "@/lib/auth/guards";
import { resolveAgencyContext } from "@/lib/tenancy/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Sync runs sequentially in batches of 5 + Reddit's ~1s response time can put
// the total well past Vercel's default 10s. 60s gives comfortable headroom
// for ~30 subreddits without forcing pagination on the operator side.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const denied = await requireEditorOrAdmin(request);
  if (denied) return denied;
  const ctx = await resolveAgencyContext(request);
  if (ctx instanceof NextResponse) return ctx;
  return subredditsController.handleSyncAll(request, ctx.agencyId);
}
