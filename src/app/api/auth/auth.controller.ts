/**
 * Auth controller — login, logout, me.
 *
 * Two-tier credentials live in env:
 *   ADMIN_USERNAME / ADMIN_PASSWORD  — full-privilege account
 *   EDITOR_USERNAME / EDITOR_PASSWORD — restricted read+entry account (optional)
 *
 * On login we walk both credential sets in constant time, decide which (if
 * any) matched, and stamp the corresponding role into the signed session
 * JWT. Downstream guards read `session.role` rather than re-checking env.
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
import type { Role } from "@/lib/auth/roles";

interface CredentialSlot {
  role: Role;
  username: string;
  password: string;
}

class AuthController {
  /**
   * Read every configured credential slot. Admin is always required;
   * editor is optional (we no-op if its env vars are missing).
   */
  private readSlots(): CredentialSlot[] {
    const slots: CredentialSlot[] = [];
    const adminUser = process.env.ADMIN_USERNAME?.trim();
    const adminPass = process.env.ADMIN_PASSWORD?.trim();
    if (!adminUser || !adminPass) {
      throw new Error(
        "ADMIN_USERNAME and ADMIN_PASSWORD must be set in the environment.",
      );
    }
    slots.push({ role: "admin", username: adminUser, password: adminPass });

    const editorUser = process.env.EDITOR_USERNAME?.trim();
    const editorPass = process.env.EDITOR_PASSWORD?.trim();
    if (editorUser && editorPass) {
      slots.push({ role: "editor", username: editorUser, password: editorPass });
    }
    return slots;
  }

  /** Constant-time string compare to dodge timing-side-channel guesses. */
  private safeEqual(a: string, b: string): boolean {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) return false;
    return timingSafeEqual(aBuf, bBuf);
  }

  /**
   * Find the slot whose username + password match. We always evaluate every
   * slot (no short-circuit on first user mismatch) so the response time
   * doesn't leak which usernames exist.
   */
  private match(
    submittedUser: string,
    submittedPass: string,
    slots: CredentialSlot[],
  ): CredentialSlot | null {
    let matched: CredentialSlot | null = null;
    for (const slot of slots) {
      const userOk = this.safeEqual(submittedUser, slot.username);
      const passOk = this.safeEqual(submittedPass, slot.password);
      if (userOk && passOk) matched = slot;
    }
    return matched;
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

    let slots: CredentialSlot[];
    try {
      slots = this.readSlots();
    } catch (err) {
      console.error("[auth] env misconfigured", err);
      return NextResponse.json(
        { error: "Server is not configured for login" },
        { status: 500 },
      );
    }

    const matched = this.match(submittedUser, submittedPass, slots);
    if (!matched) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await signSession(matched.username, matched.role);
    const res = NextResponse.json({
      user: { username: matched.username, role: matched.role },
    });
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
    return NextResponse.json({
      user: { username: session.sub, role: session.role },
    });
  }
}

export const authController = new AuthController();
