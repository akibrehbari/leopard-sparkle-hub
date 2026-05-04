import { NextRequest, NextResponse } from "next/server";
import { influencersController } from "../influencers.controller";
import { requireAdmin } from "@/lib/auth/guards";
import { resolveAgencyContext } from "@/lib/tenancy/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const tenant = await resolveAgencyContext(request);
  if (tenant instanceof NextResponse) return tenant;
  const { id } = await ctx.params;
  return influencersController.handleGet(request, id, tenant.agencyId);
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const tenant = await resolveAgencyContext(request);
  if (tenant instanceof NextResponse) return tenant;
  const { id } = await ctx.params;
  return influencersController.handleUpdate(request, id, tenant.agencyId);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const tenant = await resolveAgencyContext(request);
  if (tenant instanceof NextResponse) return tenant;
  const { id } = await ctx.params;
  return influencersController.handleDelete(request, id, tenant.agencyId);
}
