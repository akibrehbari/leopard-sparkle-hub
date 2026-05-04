import { NextRequest } from "next/server";
import { agenciesController } from "../agencies.controller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight {_id, name}[] list used by the active-agency switcher.
 *
 * Visible to every authenticated session. Agency-owner sessions only see
 * their own bound agency (single-element list); admin / editor see all.
 *
 * Open to all roles (no requireAdmin) on purpose — the switcher is a UI
 * affordance, not a privileged endpoint.
 */
export async function GET(request: NextRequest) {
  return agenciesController.handleListSummaries(request);
}
