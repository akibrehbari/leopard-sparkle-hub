import "server-only";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectMongo } from "@/lib/db/mongo";
import { WorkerModel } from "./workers.model";
import { resolveAgencyContext } from "@/lib/tenancy/server";
import { isManager } from "@/lib/auth/roles";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/workers — list workers for the active agency (manager+). */
export async function GET(request: NextRequest) {
  const ctx = await resolveAgencyContext(request);
  if (ctx instanceof NextResponse) return ctx;
  if (!isManager(ctx.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await connectMongo();
  const workers = await WorkerModel.find({
    agencyId: new mongoose.Types.ObjectId(ctx.agencyId),
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

/** POST /api/workers — create a worker (manager+ only). */
export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isManager(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ctx = await resolveAgencyContext(request);
  if (ctx instanceof NextResponse) return ctx;

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

  const name = body.name?.trim();
  const loginUsername = body.loginUsername?.trim().toLowerCase();
  const loginPassword = body.loginPassword?.trim();

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!loginUsername) return NextResponse.json({ error: "loginUsername is required" }, { status: 400 });
  if (!loginPassword || loginPassword.length < 6) {
    return NextResponse.json({ error: "loginPassword must be at least 6 characters" }, { status: 400 });
  }

  await connectMongo();

  const existing = await WorkerModel.findOne({
    agencyId: new mongoose.Types.ObjectId(ctx.agencyId),
    loginUsername,
  }).lean();
  if (existing) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  const loginPasswordHash = await bcrypt.hash(loginPassword, 10);
  const assignedInfluencerIds = (body.assignedInfluencerIds ?? [])
    .filter((id) => mongoose.isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const doc = await WorkerModel.create({
    agencyId: new mongoose.Types.ObjectId(ctx.agencyId),
    name,
    loginUsername,
    loginPasswordHash,
    assignedInfluencerIds,
  });

  return NextResponse.json(
    {
      data: {
        _id: doc._id.toString(),
        name: doc.name,
        loginUsername: doc.loginUsername,
        assignedInfluencerIds: doc.assignedInfluencerIds.map((id) => id.toString()),
        createdAt: doc.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
