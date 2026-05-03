import { NextRequest } from "next/server";
import { influencersController } from "../influencers.controller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return influencersController.handleGet(request, id);
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return influencersController.handleUpdate(request, id);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return influencersController.handleDelete(request, id);
}
