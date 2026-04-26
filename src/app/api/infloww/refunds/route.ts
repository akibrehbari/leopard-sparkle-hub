import { NextRequest, NextResponse } from "next/server";
import { listRefunds, paginate } from "@/lib/infloww/client";
import { errorResponse, numParam, param, requireParam } from "../_helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  try {
    const creatorId = requireParam(searchParams, "creatorId");
    const startTime = param(searchParams, "startTime");
    const endTime = param(searchParams, "endTime");
    const limit = numParam(searchParams, "limit");
    const fetchAll = param(searchParams, "all") === "1";

    if (fetchAll) {
      const all = await paginate((cursor) =>
        listRefunds({
          creatorId,
          startTime,
          endTime,
          limit: limit ?? 100,
          cursor,
        }),
      );
      return NextResponse.json({
        data: { list: all },
        hasMore: false,
        cursor: null,
      });
    }

    const data = await listRefunds({
      creatorId,
      startTime,
      endTime,
      limit,
      cursor: param(searchParams, "cursor"),
    });
    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(err);
  }
}
