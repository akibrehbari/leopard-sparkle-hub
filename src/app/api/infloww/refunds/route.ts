import { NextRequest } from "next/server";
import { inflowwController } from "../infloww.controller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return inflowwController.handleGetRefunds(request);
}
