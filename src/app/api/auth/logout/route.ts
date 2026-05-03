import { authController } from "../auth.controller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return authController.handleLogout();
}
