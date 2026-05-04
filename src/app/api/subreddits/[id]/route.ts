import { NextRequest } from "next/server";
import { subredditsController } from "../subreddits.controller";
import { requireAdmin } from "@/lib/auth/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return subredditsController.handleGet(request, id);
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const { id } = await ctx.params;
  return subredditsController.handleUpdate(request, id);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const { id } = await ctx.params;
  return subredditsController.handleDelete(request, id);
}
