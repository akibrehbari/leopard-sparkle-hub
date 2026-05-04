/**
 * Route-handler guards for role-gated endpoints.
 *
 * The proxy already kicks out anonymous users; these helpers add a second
 * authorization layer for routes that admins alone (or admins + editors)
 * should be able to call. Agency-owner sessions are read-only, so they hit
 * 403 on every guard here.
 *
 * Usage:
 *
 *   const denied = await requireAdmin(request);
 *   if (denied) return denied;
 *   // ...do admin-only thing
 *
 *   const denied = await requireEditorOrAdmin(request);
 *   if (denied) return denied;
 *   // ...do data-entry / sync thing
 */
import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, verifySession } from "./session";
import { isAdmin, isEditorOrAdmin } from "./roles";

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

/**
 * Returns null for admin/editor sessions; 401/403 otherwise. Used by routes
 * that perform writes the editor is allowed to do (weekly entry, sync) but
 * agency owners are not.
 */
export async function requireEditorOrAdmin(
  request: NextRequest,
): Promise<NextResponse | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isEditorOrAdmin(session.role)) {
    return NextResponse.json(
      { error: "Forbidden: read-only role" },
      { status: 403 },
    );
  }
  return null;
}
