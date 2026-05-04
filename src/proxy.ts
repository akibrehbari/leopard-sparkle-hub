/**
 * Auth gate proxy.
 *
 * Runs in the Edge runtime, so it can only use Edge-safe APIs (jose, no
 * mongoose). It checks the session cookie on every request and either:
 *   - Lets the request through (valid session, or path is on the bypass list).
 *   - Redirects pages to /login.
 *   - Returns 401 JSON for /api/* routes.
 *
 * The matcher excludes Next.js internals + static assets so we don't waste
 * cycles verifying JWTs for image requests.
 *
 * Note: this file uses the `proxy` file convention introduced in Next.js 16.
 * It replaces the deprecated `middleware` convention; behavior is unchanged.
 */
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

const PUBLIC_PATHS = ["/login", "/share"];
/**
 * Path prefixes that bypass auth.
 *
 * `/share` (page, single + multi model) and `/api/share/` (data) are
 * intentionally public — anyone with the unguessable influencer ID(s) in
 * the URL can view a read-only snapshot of that influencer's dashboard. A
 * MongoDB ObjectId provides ~96 bits of entropy, which is treated as a
 * bearer token here.
 *
 * NOTE: `/share` (no trailing slash) is matched via PUBLIC_PATHS above so
 * the new `?ids=&selected=&range=` route works; `/share/<id>` still flows
 * through the prefix below.
 */
const PUBLIC_PREFIXES = ["/share/", "/api/share/", "/api/auth/"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (session) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|css|js|map)$).*)",
  ],
};
