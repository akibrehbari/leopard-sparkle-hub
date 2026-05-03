import { platformsController } from "./platforms.controller";

export const runtime = "nodejs";
export const dynamic = "force-static";

export async function GET() {
  return platformsController.handleList();
}
