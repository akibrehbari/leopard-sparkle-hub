import { NextRequest } from "next/server";
import { authController } from "../auth.controller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return authController.handleMe(request);
}
