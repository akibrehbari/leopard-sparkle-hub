/**
 * Public read-only share endpoint.
 *
 * GET /api/share/[id]?range=7d|30d|90d
 *
 * Bypassed in middleware.ts — knowing the influencer ObjectId is the only
 * credential. Returns the same composite payload the /share page renders.
 */
import { NextRequest } from "next/server";
import { shareController } from "../share.controller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return shareController.handleGet(request, id);
}
