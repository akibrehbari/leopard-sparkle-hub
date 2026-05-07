import { NextRequest, NextResponse } from "next/server";
import { entriesController } from "./entries.controller";
import { requireEditorOrAdmin } from "@/lib/auth/guards";
import { resolveAgencyContext } from "@/lib/tenancy/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ctx = await resolveAgencyContext(request);
  if (ctx instanceof NextResponse) return ctx;
  return entriesController.handleList(request, ctx.agencyId, {
    pinnedInfluencerId: ctx.influencerId,
    stripSpend: ctx.role === "influencer",
  });
}

export async function PUT(request: NextRequest) {
  const denied = await requireEditorOrAdmin(request);
  if (denied) return denied;
  const ctx = await resolveAgencyContext(request);
  if (ctx instanceof NextResponse) return ctx;
  return entriesController.handleUpsert(request, ctx.agencyId);
}

export async function DELETE(request: NextRequest) {
  const denied = await requireEditorOrAdmin(request);
  if (denied) return denied;
  const ctx = await resolveAgencyContext(request);
  if (ctx instanceof NextResponse) return ctx;
  return entriesController.handleDelete(request, ctx.agencyId);
}
