/**
 * Server-side tenancy resolver.
 *
 * Every domain route (influencers, entries, subreddits, ...) calls
 * `resolveAgencyContext(request)` first. The resolver returns either:
 *
 *   - `{ agencyId, role }` — caller scopes its query/mutation by agencyId.
 *   - `NextResponse` — caller returns it verbatim (401 / 403 / 400).
 *
 * Resolution rules:
 *
 *   - No session                → 401 Unauthorized.
 *   - role === "agency_owner"   → agencyId comes from the JWT. The active-
 *                                 agency cookie is ignored entirely so a
 *                                 hostile owner can't rebind to another
 *                                 agency by editing the cookie.
 *   - role === "admin"|"editor" → agencyId comes from the active-agency
 *                                 cookie. The cookie value is validated
 *                                 against the agencies collection; missing
 *                                 / invalid / unknown → 400 with a clear
 *                                 message the UI uses to prompt the user
 *                                 to pick an agency.
 *
 * The result is intentionally narrow (just `agencyId` + `role`); callers
 * that need the full session payload can call `verifySession` directly.
 */
import "server-only";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { connectMongo } from "@/lib/db/mongo";
import { AgencyModel } from "@/app/api/agencies/agencies.model";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { ACTIVE_AGENCY_COOKIE } from "@/lib/tenancy/active-agency";
import type { Role } from "@/lib/auth/roles";

export interface AgencyContext {
  agencyId: string;
  role: Role;
  /** Only set for influencer sessions — the influencer's own document id. */
  influencerId?: string;
}

/**
 * Per-request micro-cache for "does this agencyId exist?" lookups, so a
 * single API call that touches multiple sub-controllers doesn't ping Mongo
 * for the same id N times.
 */
const knownAgencyCache = new Map<string, number>();
const KNOWN_AGENCY_TTL_MS = 30_000;

async function isKnownAgency(agencyId: string): Promise<boolean> {
  const now = Date.now();
  const seen = knownAgencyCache.get(agencyId);
  if (seen && now - seen < KNOWN_AGENCY_TTL_MS) return true;

  if (!mongoose.isValidObjectId(agencyId)) return false;
  await connectMongo();
  const exists = await AgencyModel.exists({ _id: agencyId });
  if (exists) {
    knownAgencyCache.set(agencyId, now);
    return true;
  }
  return false;
}

export async function resolveAgencyContext(
  request: NextRequest,
): Promise<AgencyContext | NextResponse> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role === "influencer") {
    if (!session.agencyId || !session.influencerId) {
      return NextResponse.json({ error: "Session missing bindings" }, { status: 401 });
    }
    return { agencyId: session.agencyId, role: session.role, influencerId: session.influencerId };
  }

  if (session.role === "agency_owner") {
    if (!session.agencyId) {
      return NextResponse.json(
        { error: "Session missing agency binding" },
        { status: 401 },
      );
    }
    return { agencyId: session.agencyId, role: session.role };
  }

  // admin / editor: read cookie, validate, otherwise prompt.
  const cookie = request.cookies.get(ACTIVE_AGENCY_COOKIE)?.value?.trim();
  if (!cookie) {
    return NextResponse.json(
      {
        error: "No active agency selected",
        code: "no_active_agency",
      },
      { status: 400 },
    );
  }
  if (!(await isKnownAgency(cookie))) {
    return NextResponse.json(
      {
        error: "Active agency no longer exists. Pick another from the switcher.",
        code: "no_active_agency",
      },
      { status: 400 },
    );
  }
  return { agencyId: cookie, role: session.role };
}

/**
 * Helper for routes that need to know if the request CAME from an agency
 * owner without imposing a tenant context yet (e.g. the agencies-list
 * endpoint, which returns 1 record for owners and N for admin/editor).
 */
export async function getSessionRole(
  request: NextRequest,
): Promise<{ role: Role; agencyId?: string } | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) return null;
  return { role: session.role, agencyId: session.agencyId };
}
