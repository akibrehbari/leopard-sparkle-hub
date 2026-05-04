import { NextRequest, NextResponse } from "next/server";
import { subredditsController } from "../../subreddits.controller";
import { requireEditorOrAdmin } from "@/lib/auth/guards";
import { resolveAgencyContext } from "@/lib/tenancy/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const denied = await requireEditorOrAdmin(request);
  if (denied) return denied;
  const tenant = await resolveAgencyContext(request);
  if (tenant instanceof NextResponse) return tenant;
  const { id } = await ctx.params;
  return subredditsController.handleSyncOne(request, id, tenant.agencyId);
}
