import { NextRequest, NextResponse } from "next/server";
import { listCreators } from "@/lib/infloww/client";
import { errorResponse, numParam, param } from "../_helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  try {
    const data = await listCreators({
      limit: numParam(searchParams, "limit"),
      cursor: param(searchParams, "cursor"),
      platformCode: param(searchParams, "platformCode"),
    });
    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(err);
  }
}
