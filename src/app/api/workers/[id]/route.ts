import "server-only";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectMongo } from "@/lib/db/mongo";
import { WorkerModel } from "../workers.model";
import { resolveAgencyContext } from "@/lib/tenancy/server";
import { isManager } from "@/lib/auth/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/workers/[id] — update name, password, or assigned influencers. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const ctx = await resolveAgencyContext(request);
  if (ctx instanceof NextResponse) return ctx;
  if (!isManager(ctx.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: {
    name?: string;
    loginUsername?: string;
    loginPassword?: string;
    assignedInfluencerIds?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (body.name?.trim()) update.name = body.name.trim();

  if (body.loginUsername?.trim()) {
    const username = body.loginUsername.trim().toLowerCase();
    const conflict = await WorkerModel.findOne({
      agencyId: new mongoose.Types.ObjectId(ctx.agencyId),
      loginUsername: username,
      _id: { $ne: new mongoose.Types.ObjectId(id) },
    }).lean();
    if (conflict) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }
    update.loginUsername = username;
  }

  if (body.loginPassword?.trim()) {
    if (body.loginPassword.trim().length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 },
      );
    }
    update.loginPasswordHash = await bcrypt.hash(body.loginPassword.trim(), 10);
  }

  if (Array.isArray(body.assignedInfluencerIds)) {
    update.assignedInfluencerIds = body.assignedInfluencerIds
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await connectMongo();
  const doc = await WorkerModel.findOneAndUpdate(
    { _id: id, agencyId: new mongoose.Types.ObjectId(ctx.agencyId) },
    { $set: update },
    { new: true, runValidators: true },
  ).lean();

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    data: {
      _id: doc._id.toString(),
      name: doc.name,
      loginUsername: doc.loginUsername,
      assignedInfluencerIds: doc.assignedInfluencerIds.map((id) => id.toString()),
      createdAt: doc.createdAt.toISOString(),
    },
  });
}

/** DELETE /api/workers/[id] */
export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const ctx = await resolveAgencyContext(request);
  if (ctx instanceof NextResponse) return ctx;
  if (!isManager(ctx.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  await connectMongo();
  const res = await WorkerModel.findOneAndDelete({
    _id: id,
    agencyId: new mongoose.Types.ObjectId(ctx.agencyId),
  });
  if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
