/**
 * Seed a test worker (username: worker, password: worker13) for every agency.
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." node scripts/seed-test-workers.mjs
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI env var is required.");
  process.exit(1);
}

await mongoose.connect(MONGODB_URI);

const AgencySchema = new mongoose.Schema({ name: String }, { collection: "agencies" });
const WorkerSchema = new mongoose.Schema(
  {
    agencyId: mongoose.Schema.Types.ObjectId,
    name: String,
    loginUsername: String,
    loginPasswordHash: String,
    assignedInfluencerIds: [mongoose.Schema.Types.ObjectId],
  },
  { timestamps: true, collection: "workers" },
);

const Agency = mongoose.models.Agency || mongoose.model("Agency", AgencySchema);
const Worker = mongoose.models.Worker || mongoose.model("Worker", WorkerSchema);

const agencies = await Agency.find({}).lean();
if (agencies.length === 0) {
  console.log("No agencies found. Nothing to seed.");
  await mongoose.disconnect();
  process.exit(0);
}

const hash = await bcrypt.hash("worker13", 10);
let created = 0;
let skipped = 0;

for (const agency of agencies) {
  const exists = await Worker.findOne({ agencyId: agency._id, loginUsername: "worker" }).lean();
  if (exists) {
    console.log(`  SKIP  [${agency.name}] — worker already exists`);
    skipped++;
    continue;
  }
  await Worker.create({
    agencyId: agency._id,
    name: "Worker",
    loginUsername: "worker",
    loginPasswordHash: hash,
    assignedInfluencerIds: [],
  });
  console.log(`  OK    [${agency.name}] — worker created`);
  created++;
}

console.log(`\nDone. Created: ${created}, Skipped (already existed): ${skipped}`);
await mongoose.disconnect();
