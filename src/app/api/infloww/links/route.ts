import { NextRequest, NextResponse } from "next/server";
import { listLinks } from "@/lib/infloww/client";
import type { InflowwLinkType } from "@/lib/infloww/types";
import { errorResponse, numParam, param, requireParam } from "../_helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_LINK_TYPES: InflowwLinkType[] = ["CAMPAIGN", "TRIAL", "TRACKING"];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  try {
    const creatorId = requireParam(searchParams, "creatorId");
    const linkTypeRaw = param(searchParams, "linkType") ?? "TRIAL";
    if (!VALID_LINK_TYPES.includes(linkTypeRaw as InflowwLinkType)) {
      return NextResponse.json(
        {
          error: `Invalid linkType. Must be one of: ${VALID_LINK_TYPES.join(", ")}`,
        },
        { status: 400 },
      );
    }
    const data = await listLinks({
      creatorId,
      linkType: linkTypeRaw as InflowwLinkType,
      startTime: param(searchParams, "startTime"),
      endTime: param(searchParams, "endTime"),
      limit: numParam(searchParams, "limit"),
      cursor: param(searchParams, "cursor"),
    });
    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(err);
  }
}
