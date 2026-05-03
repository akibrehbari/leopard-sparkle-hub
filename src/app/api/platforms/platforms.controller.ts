/**
 * Platforms controller — exposes the static PLATFORMS registry so the client
 * never has to import the server-side module directly. Pure read-only.
 */
import "server-only";

import { NextResponse } from "next/server";
import { PLATFORMS } from "@/lib/platforms/registry";

class PlatformsController {
  async handleList(): Promise<NextResponse> {
    return NextResponse.json({ data: PLATFORMS });
  }
}

export const platformsController = new PlatformsController();
