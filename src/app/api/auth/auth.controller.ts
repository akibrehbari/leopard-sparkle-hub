/**
 * Auth controller — login, logout, me.
 *
 * Three credential sources walked at login time:
 *
 *   1. ADMIN_USERNAME / ADMIN_PASSWORD                — env, full-access role.
 *   2. EDITOR_USERNAME / EDITOR_PASSWORD              — env, restricted writer.
 *   3. agencies.ownerUsername / .ownerPasswordHash    — DB, agency_owner role.
 *
 * Walk order is "all of them, every time" so that:
 *   - timing doesn't leak which usernames exist (env env vs DB miss vs DB hit
 *     all take roughly the same wall-clock time thanks to bcrypt dominating);
 *   - duplicate usernames across sources just produce no match (the first
 *     credential set whose username matches but password doesn't loses).
 *
 * Once we identify which credential matched, we sign the JWT with the
 * appropriate role and (for agency owners) the bound `agencyId`. Downstream
 * guards read `session.role` rather than re-checking env or DB.
 */
import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
  verifySession,
} from "@/lib/auth/session";
import type { Role } from "@/lib/auth/roles";
import { connectMongo } from "@/lib/db/mongo";
import { AgencyModel, type AgencyDoc } from "@/app/api/agencies/agencies.model";
import { InfluencerModel, type InfluencerDoc } from "@/app/api/influencers/influencers.model";

interface EnvCredentialSlot {
  kind: "env";
  role: Exclude<Role, "agency_owner">;
  username: string;
  password: string;
}

interface MatchedSlot {
  role: Role;
  username: string;
  agencyId?: string;
  influencerId?: string;
}

class AuthController {
  /**
   * Read every configured env credential slot. Admin is required; editor is
   * optional (we no-op if its env vars are missing).
   */
  private readEnvSlots(): EnvCredentialSlot[] {
    const slots: EnvCredentialSlot[] = [];
    const adminUser = process.env.ADMIN_USERNAME?.trim();
    const adminPass = process.env.ADMIN_PASSWORD?.trim();
    if (!adminUser || !adminPass) {
      throw new Error(
        "ADMIN_USERNAME and ADMIN_PASSWORD must be set in the environment.",
      );
    }
    slots.push({ kind: "env", role: "admin", username: adminUser, password: adminPass });

    const editorUser = process.env.EDITOR_USERNAME?.trim();
    const editorPass = process.env.EDITOR_PASSWORD?.trim();
    if (editorUser && editorPass) {
      slots.push({
        kind: "env",
        role: "editor",
        username: editorUser,
        password: editorPass,
      });
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
   * Find the first env slot whose username + password match. We always
   * evaluate every slot (no short-circuit on first user mismatch) so the
   * response time doesn't leak which usernames exist.
   */
  private matchEnv(
    submittedUser: string,
    submittedPass: string,
    slots: EnvCredentialSlot[],
  ): EnvCredentialSlot | null {
    let matched: EnvCredentialSlot | null = null;
    for (const slot of slots) {
      const userOk = this.safeEqual(submittedUser, slot.username);
      const passOk = this.safeEqual(submittedPass, slot.password);
      if (userOk && passOk) matched = slot;
    }
    return matched;
  }

  /**
   * Look up an agency by ownerUsername and bcrypt-compare the password.
   *
   * Why a query instead of "load all and compare"? Bcrypt is intentionally
   * expensive (~100ms each); doing N comparisons per login would scale
   * terribly. The single indexed lookup leaks at most "is this username
   * registered as an agency owner" via timing — exactly the same bit any
   * username-based system leaks.
   */
  private async matchAgency(
    submittedUser: string,
    submittedPass: string,
  ): Promise<AgencyDoc | null> {
    const lookup = submittedUser.toLowerCase();
    await connectMongo();
    const doc = await AgencyModel.findOne({ ownerUsername: lookup }).lean<AgencyDoc>();
    if (!doc) {
      // Run a dummy bcrypt compare so timing doesn't betray "user not found"
      // vs "user found, wrong password". The hash is a known throwaway.
      await bcrypt.compare(
        submittedPass,
        "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.J8rbpQk6cQpjpKkR2QvUnr/V2cha",
      );
      return null;
    }
    const ok = await bcrypt.compare(submittedPass, doc.ownerPasswordHash);
    return ok ? doc : null;
  }

  /**
   * Look up an influencer by loginUsername and bcrypt-compare the password.
   * Returns null if not found or password doesn't match.
   */
  private async matchInfluencer(
    submittedUser: string,
    submittedPass: string,
  ): Promise<InfluencerDoc | null> {
    const lookup = submittedUser.toLowerCase();
    await connectMongo();
    const doc = await InfluencerModel.findOne({ loginUsername: lookup }).lean<InfluencerDoc>();
    if (!doc || !doc.loginPasswordHash) {
      // Dummy compare to avoid timing leaks
      await bcrypt.compare(
        submittedPass,
        "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.J8rbpQk6cQpjpKkR2QvUnr/V2cha",
      );
      return null;
    }
    const ok = await bcrypt.compare(submittedPass, doc.loginPasswordHash);
    return ok ? doc : null;
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

    let envSlots: EnvCredentialSlot[];
    try {
      envSlots = this.readEnvSlots();
    } catch (err) {
      console.error("[auth] env misconfigured", err);
      return NextResponse.json(
        { error: "Server is not configured for login" },
        { status: 500 },
      );
    }

    // Walk env first (cheap), then DB (bcrypt). Always do all DB calls so an
    // attacker can't tell from response time whether their guess hit env.
    const envHit = this.matchEnv(submittedUser, submittedPass, envSlots);
    let dbHit: AgencyDoc | null = null;
    try {
      dbHit = await this.matchAgency(submittedUser, submittedPass);
    } catch (err) {
      console.error("[auth] agency lookup failed", err);
      // Don't leak DB failure as 500 — fall through and treat as no DB match.
    }

    let influencerHit: InfluencerDoc | null = null;
    if (!dbHit) {
      try {
        influencerHit = await this.matchInfluencer(submittedUser, submittedPass);
      } catch (err) {
        console.error("[auth] influencer lookup failed", err);
      }
    }

    let matched: MatchedSlot | null = null;
    if (envHit) {
      matched = { role: envHit.role, username: envHit.username };
    } else if (dbHit) {
      matched = {
        role: "agency_owner",
        username: dbHit.ownerUsername,
        agencyId: dbHit._id.toString(),
      };
    } else if (influencerHit) {
      matched = {
        role: "influencer",
        username: influencerHit.loginUsername ?? submittedUser.toLowerCase(),
        agencyId: influencerHit.agencyId.toString(),
        influencerId: influencerHit._id.toString(),
      };
    }

    if (!matched) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await signSession(
      matched.username,
      matched.role,
      matched.agencyId,
      matched.influencerId,
    );
    const res = NextResponse.json({
      user: {
        username: matched.username,
        role: matched.role,
        ...(matched.agencyId ? { agencyId: matched.agencyId } : {}),
        ...(matched.influencerId ? { influencerId: matched.influencerId } : {}),
      },
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
      user: {
        username: session.sub,
        role: session.role,
        ...(session.agencyId ? { agencyId: session.agencyId } : {}),
        ...(session.influencerId ? { influencerId: session.influencerId } : {}),
      },
    });
  }
}

export const authController = new AuthController();
