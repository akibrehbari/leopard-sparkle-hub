import { NextRequest } from "next/server";
import { subredditsController } from "../../subreddits.controller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return subredditsController.handleSyncOne(request, id);
}
