/**
 * Cleans up influencer handles in MongoDB.
 * Sets any empty-string or whitespace-only handle to null.
 * Run: MONGODB_URI="..." node scripts/clean-handles.mjs
 */
import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) throw new Error("MONGODB_URI not set");

const PLATFORM_KEYS = ["reddit", "instagram", "x", "onlyfans"];

const client = new MongoClient(MONGODB_URI);

try {
  await client.connect();
  const dbName = new URL(MONGODB_URI.replace("mongodb+srv://", "https://")).pathname.slice(1).split("?")[0] || "cuhvet";
  const db = client.db(dbName);
  const col = db.collection("influencers");

  const influencers = await col.find({}).toArray();
  console.log(`Found ${influencers.length} influencers`);

  let updatedCount = 0;
  for (const inf of influencers) {
    const cleared = [];
    const update = {};

    for (const key of PLATFORM_KEYS) {
      const val = inf.handles?.[key];
      if (typeof val === "string" && val.trim() === "") {
        update[`handles.${key}`] = null;
        cleared.push(key);
      }
    }

    if (Object.keys(update).length > 0) {
      await col.updateOne({ _id: inf._id }, { $set: update });
      console.log(`  ✓ ${inf.name}: cleared [${cleared.join(", ")}]`);
      updatedCount++;
    } else {
      console.log(`  - ${inf.name}: no changes needed`);
    }
  }

  console.log(`\nDone. ${updatedCount}/${influencers.length} influencers updated.`);
} finally {
  await client.close();
}
