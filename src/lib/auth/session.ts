/**
 * Session JWT helpers shared between the auth controller (Node runtime) and
 * the middleware (Edge runtime). Uses `jose` because it works in both.
 *
 * The session payload carries the username, role, and (for agency owners) the
 * agency the user is bound to. Roles + bindings are decided at login time and
 * baked into the JWT so any downstream guard can authorize without consulting
 * the env or the DB again.
 */
import { jwtVerify, SignJWT } from "jose";

import { isRole, type Role } from "./roles";

export const SESSION_COOKIE = "session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export interface SessionPayload {
  sub: string;
  role: Role;
  /**
   * Set only when `role === "agency_owner"` or `role === "influencer"`.
   * Stringified ObjectId for the agency this session is pinned to.
   * Admin/editor sessions omit this and pick an active agency via the
   * `active_agency_id` cookie instead.
   */
  agencyId?: string;
  /**
   * Set only when `role === "influencer"`. Stringified ObjectId of the
   * influencer document this session is bound to.
   */
  influencerId?: string;
  iat: number;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or too short. Set a 32+ character random string in your environment.",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(
  username: string,
  role: Role,
  agencyId?: string,
  influencerId?: string,
): Promise<string> {
  // Only embed agencyId for agency_owner / influencer sessions. Admin/editor
  // sessions intentionally have no agency bound to the JWT — they pick the
  // active agency at runtime via cookie, and switch freely.
  const payload: Record<string, unknown> = { sub: username, role };
  if (role === "agency_owner") {
    if (!agencyId) {
      throw new Error("agency_owner session requires an agencyId");
    }
    payload.agencyId = agencyId;
  }
  if (role === "influencer") {
    if (!agencyId || !influencerId) {
      throw new Error("influencer session requires both agencyId and influencerId");
    }
    payload.agencyId = agencyId;
    payload.influencerId = influencerId;
  }
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.sub !== "string" ||
      typeof payload.iat !== "number" ||
      !isRole(payload.role)
    ) {
      return null;
    }
    // Agency owners must carry an agencyId; reject malformed tokens that
    // claim the role without the binding (defense in depth — signSession
    // already enforces this on issue).
    if (payload.role === "agency_owner" && typeof payload.agencyId !== "string") {
      return null;
    }
    // Influencer sessions must carry both agencyId and influencerId.
    if (
      payload.role === "influencer" &&
      (typeof payload.agencyId !== "string" || typeof payload.influencerId !== "string")
    ) {
      return null;
    }
    const out: SessionPayload = {
      sub: payload.sub,
      role: payload.role,
      iat: payload.iat,
    };
    if (typeof payload.agencyId === "string") out.agencyId = payload.agencyId;
    if (typeof payload.influencerId === "string") out.influencerId = payload.influencerId;
    return out;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_TTL_SECONDS,
};
