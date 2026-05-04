/**
 * Session JWT helpers shared between the auth controller (Node runtime) and
 * the middleware (Edge runtime). Uses `jose` because it works in both.
 *
 * The session payload carries the username and the user's role. Roles are
 * decided at login time and baked into the JWT so any downstream guard
 * can authorize without consulting the env again.
 */
import { jwtVerify, SignJWT } from "jose";

import { isRole, type Role } from "./roles";

export const SESSION_COOKIE = "session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export interface SessionPayload {
  sub: string;
  role: Role;
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

export async function signSession(username: string, role: Role): Promise<string> {
  return new SignJWT({ sub: username, role })
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
    return { sub: payload.sub, role: payload.role, iat: payload.iat };
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
