/**
 * Auth controller — login, logout, me.
 *
 * Single-admin model: credentials live in env (ADMIN_USERNAME / ADMIN_PASSWORD).
 * On successful login we sign a JWT (`signSession`) and drop it into an
 * httpOnly cookie that the middleware reads on every request.
 */
import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
  verifySession,
} from "@/lib/auth/session";

class AuthController {
  private readEnv() {
    const username = process.env.ADMIN_USERNAME?.trim();
    const password = process.env.ADMIN_PASSWORD?.trim();
    if (!username || !password) {
      throw new Error(
        "ADMIN_USERNAME and ADMIN_PASSWORD must be set in the environment.",
      );
    }
    return { username, password };
  }

  /** Constant-time string compare to dodge timing-side-channel guesses. */
  private safeEqual(a: string, b: string): boolean {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) return false;
    return timingSafeEqual(aBuf, bBuf);
  }

  async handleLogin(request: NextRequest): Promise<NextResponse> {
    let body: { username?: string; password?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const submittedUser = (body.username ?? "").trim();
    const submittedPass = body.password ?? "";
    if (!submittedUser || !submittedPass) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 },
      );
    }

    let expected: { username: string; password: string };
    try {
      expected = this.readEnv();
    } catch (err) {
      console.error("[auth] env misconfigured", err);
      return NextResponse.json(
        { error: "Server is not configured for login" },
        { status: 500 },
      );
    }

    const userOk = this.safeEqual(submittedUser, expected.username);
    const passOk = this.safeEqual(submittedPass, expected.password);
    if (!userOk || !passOk) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await signSession(expected.username);
    const res = NextResponse.json({ user: { username: expected.username } });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return res;
  }

  async handleLogout(): Promise<NextResponse> {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
    return res;
  }

  async handleMe(request: NextRequest): Promise<NextResponse> {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const session = await verifySession(token);
    if (!session) {
      return NextResponse.json({ user: null }, { status: 401 });
    }
    return NextResponse.json({ user: { username: session.sub } });
  }
}

export const authController = new AuthController();
