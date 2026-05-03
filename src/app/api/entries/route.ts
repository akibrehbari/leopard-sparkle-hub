import { NextRequest } from "next/server";
import { entriesController } from "./entries.controller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return entriesController.handleList(request);
}

export async function PUT(request: NextRequest) {
  return entriesController.handleUpsert(request);
}

export async function DELETE(request: NextRequest) {
  return entriesController.handleDelete(request);
}
