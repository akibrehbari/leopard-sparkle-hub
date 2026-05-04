/**
 * Route-handler guards for role-gated endpoints.
 *
 * The proxy already kicks out anonymous users; these helpers add a second
 * authorization layer for routes that admins alone should be able to call
 * (e.g. creating an influencer or deleting a subreddit). Editor sessions
 * pass through unaffected for any handler that doesn't call them.
 *
 * Usage:
 *
 *   const denied = await requireAdmin(request);
 *   if (denied) return denied;
 *   // ...do admin-only thing
 */
import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, verifySession } from "./session";
import { isAdmin } from "./roles";

/**
 * Returns null when the request belongs to an admin session, or a 401/403
 * NextResponse the caller should return verbatim. Putting the response
 * generation here keeps every guarded route handler down to two lines.
 */
export async function requireAdmin(
  request: NextRequest,
): Promise<NextResponse | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.role)) {
    return NextResponse.json(
      { error: "Forbidden: admin role required" },
      { status: 403 },
    );
  }
  return null;
}
