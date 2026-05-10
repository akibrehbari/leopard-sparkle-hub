import "server-only";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectMongo } from "@/lib/db/mongo";
import { WorkerModel } from "@/app/api/workers/workers.model";
import { requireAdmin } from "@/lib/auth/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** GET /api/agencies/[id]/workers — list workers for any agency (admin only). */
export async function GET(request: NextRequest, { params }: Params) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { id: agencyId } = await params;
  if (!mongoose.isValidObjectId(agencyId)) {
    return NextResponse.json({ error: "Invalid agencyId" }, { status: 400 });
  }

  await connectMongo();
  const workers = await WorkerModel.find({
    agencyId: new mongoose.Types.ObjectId(agencyId),
  })
    .sort({ name: 1 })
    .lean();

  return NextResponse.json({
    data: workers.map((w) => ({
      _id: w._id.toString(),
      name: w.name,
      loginUsername: w.loginUsername,
      assignedInfluencerIds: w.assignedInfluencerIds.map((id) => id.toString()),
      createdAt: w.createdAt.toISOString(),
    })),
  });
}

/** POST /api/agencies/[id]/workers — create a worker for any agency (admin only). */
export async function POST(request: NextRequest, { params }: Params) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { id: agencyId } = await params;
  if (!mongoose.isValidObjectId(agencyId)) {
    return NextResponse.json({ error: "Invalid agencyId" }, { status: 400 });
  }

  let body: { name?: string; loginUsername?: string; loginPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  const loginUsername = body.loginUsername?.trim().toLowerCase();
  const loginPassword = body.loginPassword?.trim();

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!loginUsername) return NextResponse.json({ error: "loginUsername is required" }, { status: 400 });
  if (!loginPassword || loginPassword.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  await connectMongo();

  const existing = await WorkerModel.findOne({
    agencyId: new mongoose.Types.ObjectId(agencyId),
    loginUsername,
  }).lean();
  if (existing) {
    return NextResponse.json({ error: "Username already taken in this agency" }, { status: 409 });
  }

  const doc = await WorkerModel.create({
    agencyId: new mongoose.Types.ObjectId(agencyId),
    name,
    loginUsername,
    loginPasswordHash: await bcrypt.hash(loginPassword, 10),
    assignedInfluencerIds: [],
  });

  return NextResponse.json(
    {
      data: {
        _id: doc._id.toString(),
        name: doc.name,
        loginUsername: doc.loginUsername,
        assignedInfluencerIds: [],
        createdAt: doc.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}

/** DELETE /api/agencies/[id]/workers?workerId=xxx — delete a specific worker (admin only). */
export async function DELETE(request: NextRequest, { params }: Params) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { id: agencyId } = await params;
  const workerId = new URL(request.url).searchParams.get("workerId");

  if (!mongoose.isValidObjectId(agencyId) || !mongoose.isValidObjectId(workerId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await connectMongo();
  const res = await WorkerModel.findOneAndDelete({
    _id: workerId,
    agencyId: new mongoose.Types.ObjectId(agencyId),
  });

  if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
