import { NextRequest } from "next/server";
import { subredditsController } from "./subreddits.controller";
import { requireAdmin } from "@/lib/auth/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return subredditsController.handleList(request);
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  return subredditsController.handleCreate(request);
}
