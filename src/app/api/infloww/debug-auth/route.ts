/**
 * Temporary diagnostic endpoint to figure out why Infloww is returning 401.
 *
 * Reveals only fingerprints of env vars (length + first/last chars) — never the
 * actual values. Tries the documented `Bearer <key>` auth, then a bare-key
 * fallback, and returns each upstream response's status, requestId, and body
 * so we can see Infloww's full rejection reason.
 *
 * Gated behind a DEBUG_TOKEN env var so it can't be hit anonymously. Set the
 * token in Vercel and call:
 *   GET /api/infloww/debug-auth?token=<your-token>
 *
 * DELETE THIS FILE once the auth issue is diagnosed.
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE_URL = "https://openapi.infloww.com";

/** Fingerprint a secret without leaking it. */
function fingerprint(value: string | undefined) {
  if (!value) return { present: false } as const;
  const trimmed = value.trim();
  return {
    present: true,
    length: value.length,
    trimmedLength: trimmed.length,
    hadWhitespace: value.length !== trimmed.length,
    prefix: trimmed.slice(0, 3),
    suffix: trimmed.slice(-3),
  };
}

async function tryAuth(authHeader: string, oid: string) {
  const url = new URL(BASE_URL + "/v1/creators");
  url.searchParams.set("limit", "1");

  const resp = await fetch(url, {
    headers: {
      Authorization: authHeader,
      "x-oid": oid,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await resp.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 500);
  }
  return {
    status: resp.status,
    ok: resp.ok,
    requestId: resp.headers.get("x-request-id"),
    cfRay: resp.headers.get("cf-ray"),
    server: resp.headers.get("server"),
    body,
  };
}

export async function GET(request: NextRequest) {
  const token = process.env.DEBUG_TOKEN;
  const provided = new URL(request.url).searchParams.get("token");
  if (!token || token !== provided) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = process.env.INFLOW_API_KEY?.trim() ?? "";
  const oid = process.env.INFLOW_AGENCY_OID?.trim() ?? "";

  const env = {
    INFLOW_API_KEY: fingerprint(process.env.INFLOW_API_KEY),
    INFLOW_AGENCY_OID: fingerprint(process.env.INFLOW_AGENCY_OID),
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV ?? null,
    VERCEL_REGION: process.env.VERCEL_REGION ?? null,
  };

  if (!apiKey || !oid) {
    return NextResponse.json({ env, error: "Missing credentials" }, { status: 200 });
  }

  // Try the documented shape, then a bare-key fallback. The OpenAPI spec says
  // `Bearer <token>`, but if Infloww quietly accepts a bare key we'll see it.
  const attempts = {
    bearer: await tryAuth(`Bearer ${apiKey}`, oid),
    bare: await tryAuth(apiKey, oid),
  };

  return NextResponse.json({ env, attempts });
}
