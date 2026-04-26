/**
 * Shared helpers for Infloww route handlers. Keeps each route file thin and
 * gives us one place to massage error responses + query parameter parsing.
 */
import { NextResponse } from "next/server";
import { InflowwApiError } from "@/lib/infloww/client";

/**
 * Convert an unknown error into a Next.js JSON response. Hides server-internal
 * details from the client while preserving useful upstream messages.
 */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof InflowwApiError) {
    return NextResponse.json(
      {
        error: err.message,
        upstreamStatus: err.status,
        requestId: err.requestId,
        // Forward upstream body so callers can see Infloww's full reason.
        // It contains no secrets — only their server-side error metadata.
        upstreamBody: err.body,
      },
      { status: err.status >= 400 && err.status < 600 ? err.status : 502 },
    );
  }
  console.error("[infloww route] unexpected error", err);
  return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}

/** Read a query param as a string, or undefined if missing/empty. */
export function param(searchParams: URLSearchParams, name: string): string | undefined {
  const v = searchParams.get(name);
  return v && v.length > 0 ? v : undefined;
}

/** Read a query param as a number, or undefined. */
export function numParam(searchParams: URLSearchParams, name: string): number | undefined {
  const v = searchParams.get(name);
  if (v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Require a non-empty string param, throwing a 400 response if missing. */
export function requireParam(
  searchParams: URLSearchParams,
  name: string,
): string {
  const v = param(searchParams, name);
  if (!v) {
    throw new InflowwApiError({
      status: 400,
      message: `Missing required query parameter: ${name}`,
      body: null,
      requestId: null,
    });
  }
  return v;
}
