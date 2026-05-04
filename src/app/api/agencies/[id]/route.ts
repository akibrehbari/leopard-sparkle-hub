import { NextRequest } from "next/server";
import { agenciesController } from "../agencies.controller";
import { requireAdmin } from "@/lib/auth/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const { id } = await ctx.params;
  return agenciesController.handleUpdate(request, id);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const { id } = await ctx.params;
  return agenciesController.handleDelete(request, id);
}
