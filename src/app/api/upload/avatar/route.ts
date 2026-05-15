/**
 * POST /api/upload/avatar
 * Accepts a multipart form with a single `file` field (image).
 * Uploads to Vercel Blob and returns { url }.
 * Auth: admin only.
 */
import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireManager } from "@/lib/auth/guards";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = await requireManager(request);
  if (denied) return denied;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file || !file.type.startsWith("image/")) {
    return NextResponse.json({ error: "A valid image file is required" }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Image must be under 5MB" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const filename = `avatars/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const blob = await put(filename, file, {
    access: "public",
    contentType: file.type,
  });

  return NextResponse.json({ url: blob.url });
}
