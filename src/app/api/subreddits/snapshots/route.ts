import { NextRequest, NextResponse } from "next/server";
import { subredditsController } from "../subreddits.controller";
import { requireManager } from "@/lib/auth/guards";
import { resolveAgencyContext } from "@/lib/tenancy/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const denied = await requireManager(request);
  if (denied) return denied;
  const ctx = await resolveAgencyContext(request);
  if (ctx instanceof NextResponse) return ctx;
  return subredditsController.handleUpsertSnapshot(request, ctx.agencyId);
}
