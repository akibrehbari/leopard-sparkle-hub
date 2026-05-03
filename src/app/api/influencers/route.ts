import { NextRequest } from "next/server";
import { influencersController } from "./influencers.controller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return influencersController.handleList(request);
}

export async function POST(request: NextRequest) {
  return influencersController.handleCreateManual(request);
}
