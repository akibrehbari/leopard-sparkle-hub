import { NextRequest, NextResponse } from "next/server";
import { subredditsController } from "./subreddits.controller";
import { requireAdmin } from "@/lib/auth/guards";
import { resolveAgencyContext } from "@/lib/tenancy/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ctx = await resolveAgencyContext(request);
  if (ctx instanceof NextResponse) return ctx;
  return subredditsController.handleList(request, ctx.agencyId);
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const ctx = await resolveAgencyContext(request);
  if (ctx instanceof NextResponse) return ctx;
  return subredditsController.handleCreate(request, ctx.agencyId);
}
