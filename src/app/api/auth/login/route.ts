import { NextRequest } from "next/server";
import { authController } from "../auth.controller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return authController.handleLogin(request);
}
