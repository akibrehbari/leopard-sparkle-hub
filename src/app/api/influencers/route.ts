import { NextRequest, NextResponse } from "next/server";
import { influencersController } from "./influencers.controller";
import { requireManager } from "@/lib/auth/guards";
import { resolveAgencyContext } from "@/lib/tenancy/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ctx = await resolveAgencyContext(request);
  if (ctx instanceof NextResponse) return ctx;
  return influencersController.handleList(request, ctx.agencyId, ctx.influencerId, ctx.workerId);
}

export async function POST(request: NextRequest) {
  const denied = await requireManager(request);
  if (denied) return denied;
  const ctx = await resolveAgencyContext(request);
  if (ctx instanceof NextResponse) return ctx;
  return influencersController.handleCreate(request, ctx.agencyId);
}
