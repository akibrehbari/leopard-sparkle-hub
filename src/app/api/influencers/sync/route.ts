import { NextRequest } from "next/server";
import { influencersController } from "../influencers.controller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return influencersController.handleSync(request);
}
