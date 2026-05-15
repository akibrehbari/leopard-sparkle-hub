/**
 * Migrates all influencers, weekly entries, subreddits, and workers
 * from old agency IDs to the new Cuhvet agency.
 * Run with: node --env-file=.env.local scripts/migrate-to-cuhvet.mjs
 */
import { MongoClient, ObjectId } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) throw new Error("MONGODB_URI not set");

const NEW_AGENCY_ID = "6a0006ae22ba3fc660de0add";

const client = new MongoClient(MONGODB_URI);
await client.connect();

// Use the database name from the URI (eleopards)
const db = client.db();

console.log("Connected to:", db.databaseName);

// 1. Find all existing agencies (old ones)
const agencies = await db.collection("agencies").find({}).toArray();
console.log("Agencies found:", agencies.map(a => `${a._id} (${a.name})`));

const oldAgencyIds = agencies
  .filter(a => a._id.toString() !== NEW_AGENCY_ID)
  .map(a => a._id);

if (oldAgencyIds.length === 0) {
  console.log("No old agencies to migrate from — checking for orphaned docs...");
}

const newAgencyObjId = new ObjectId(NEW_AGENCY_ID);

// 2. Migrate influencers
const influencers = await db.collection("influencers").find({}).toArray();
console.log(`\nInfluencers total: ${influencers.length}`);
const needsMigration = influencers.filter(i => i.agencyId?.toString() !== NEW_AGENCY_ID);
console.log(`Influencers to migrate: ${needsMigration.length}`);

if (needsMigration.length > 0) {
  const res = await db.collection("influencers").updateMany(
    { _id: { $in: needsMigration.map(i => i._id) } },
    { $set: { agencyId: newAgencyObjId } }
  );
  console.log(`✓ Influencers migrated: ${res.modifiedCount}`);
}

// 3. Migrate weekly entries
const entriesRes = await db.collection("weeklyentries").updateMany(
  { agencyId: { $ne: newAgencyObjId } },
  { $set: { agencyId: newAgencyObjId } }
);
console.log(`✓ Weekly entries migrated: ${entriesRes.modifiedCount}`);

// 4. Migrate subreddits
const subredditsRes = await db.collection("subreddits").updateMany(
  { agencyId: { $ne: newAgencyObjId } },
  { $set: { agencyId: newAgencyObjId } }
);
console.log(`✓ Subreddits migrated: ${subredditsRes.modifiedCount}`);

// 5. Migrate workers
const workersRes = await db.collection("workers").updateMany(
  { agencyId: { $ne: newAgencyObjId } },
  { $set: { agencyId: newAgencyObjId } }
);
console.log(`✓ Workers migrated: ${workersRes.modifiedCount}`);

// 6. Remove old agencies
if (oldAgencyIds.length > 0) {
  const delRes = await db.collection("agencies").deleteMany(
    { _id: { $in: oldAgencyIds } }
  );
  console.log(`✓ Old agencies removed: ${delRes.deletedCount}`);
}

console.log("\n✅ Migration complete!");
await client.close();
