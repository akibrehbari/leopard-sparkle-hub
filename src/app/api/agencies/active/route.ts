/**
 * Active-agency endpoint.
 *
 * `GET` returns the full agency record bound to the current session
 * (cookie for admin/editor, JWT for agency_owner). Used by the topbar to
 * render the agency's outbound links. Returns `{ data: null }` when no
 * agency is active yet (e.g. a freshly-logged-in admin who hasn't
 * selected one).
 *
 * `POST { agencyId }` writes the `active_agency_id` cookie after
 * validating that the agency exists. Used by admin / editor sessions when
 * they pick a different agency in the topbar switcher.
 *
 * Agency-owner sessions cannot change their active agency — their binding
 * lives in the JWT. We return 403 for them on POST so the UI can hide the
 * switcher accordingly.
 */
import { NextRequest, NextResponse } from "next/server";

import { agenciesController } from "../agencies.controller";
import { getSessionRole } from "@/lib/tenancy/server";
import {
  ACTIVE_AGENCY_COOKIE,
  activeAgencyCookieOptions,
} from "@/lib/tenancy/active-agency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return agenciesController.handleGetActive(request);
}

export async function POST(request: NextRequest) {
  const session = await getSessionRole(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role === "agency_owner") {
    return NextResponse.json(
      { error: "Agency owners cannot switch agencies" },
      { status: 403 },
    );
  }

  let body: { agencyId?: string };
  try {
    body = (await request.json()) as { agencyId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const agencyId = body?.agencyId?.trim();
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId is required" }, { status: 400 });
  }
  const exists = await agenciesController.assertAgencyExists(agencyId);
  if (!exists) {
    return NextResponse.json({ error: "Unknown agency" }, { status: 404 });
  }

  const res = NextResponse.json({ ok: true, agencyId });
  res.cookies.set(ACTIVE_AGENCY_COOKIE, agencyId, activeAgencyCookieOptions);
  return res;
}
