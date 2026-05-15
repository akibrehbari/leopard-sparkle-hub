/**
 * Seeds mock weekly history for W05–W14 2026.
 * Values start near 0 and build linearly toward each influencer's
 * earliest real entry, with small random variation.
 * Revenue/subscribers stay 0 (matching real W15 data).
 * Spend stays consistent with whatever weekly spend was in W15.
 */
import { MongoClient, ObjectId } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) throw new Error("MONGODB_URI not set");

const client = new MongoClient(MONGODB_URI);
await client.connect();
const db = client.db();

// Weeks to generate (W05–W14 inclusive)
const MOCK_WEEKS = [
  "2026-W05","2026-W06","2026-W07","2026-W08","2026-W09",
  "2026-W10","2026-W11","2026-W12","2026-W13","2026-W14",
];
const TOTAL = MOCK_WEEKS.length; // 10

function jitter(val, pct = 0.05) {
  // add ±pct random noise, return integer
  const delta = val * pct * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(val + delta));
}

// Load all real entries
const realEntries = await db.collection("weekly_entries").find({}).toArray();

// Group by influencerId + platform → sorted list of { weekKey, data }
const groups = new Map();
for (const e of realEntries) {
  const key = `${e.influencerId}|${e.platform}`;
  if (!groups.has(key)) groups.set(key, []);
  let data = {};
  if (e.data && typeof e.data === "object") {
    data = e.data instanceof Map ? Object.fromEntries(e.data) : { ...e.data };
  }
  groups.get(key).push({
    weekKey: e.weekKey,
    data,
    agencyId: e.agencyId,
    influencerId: e.influencerId,
    platform: e.platform,
    _id: e._id,
  });
}

// Sort each group by weekKey and take the earliest real entry as baseline
const toInsert = [];

for (const [, entries] of groups) {
  entries.sort((a, b) => a.weekKey.localeCompare(b.weekKey));
  const earliest = entries[0];
  const { influencerId, platform, agencyId, data: baseData } = earliest;

  // Skip if mock weeks already exist for this combination
  const existingMock = realEntries.filter(
    e => e.influencerId?.toString() === influencerId?.toString()
      && e.platform === platform
      && MOCK_WEEKS.includes(e.weekKey)
  );
  if (existingMock.length > 0) {
    console.log(`  skip ${platform} for ${influencerId} — mock data exists`);
    continue;
  }

  // Determine field types
  const isCumulative = (key) =>
    key === "followers" || key === "karma" || key === "posts" || key === "subscribers";
  const isRevenue = (key) => key.startsWith("revenue_");
  const isSpend = (key) => key.startsWith("spend_");

  for (let i = 0; i < TOTAL; i++) {
    const weekKey = MOCK_WEEKS[i];
    // Factor: 0.0 at W05, ~0.90 at W14
    const factor = i / (TOTAL + 1);
    const data = {};

    for (const [field, baseVal] of Object.entries(baseData)) {
      if (isRevenue(field)) {
        // Revenue was 0 in early weeks
        data[field] = 0;
      } else if (isSpend(field)) {
        // Keep the same weekly spend as the first real entry
        data[field] = baseVal;
      } else if (field === "subscribers") {
        // Subscribers were 0 early on
        data[field] = 0;
      } else if (isCumulative(field)) {
        // Build linearly from 0 → baseVal
        data[field] = jitter(Math.round(baseVal * factor), 0.04);
      } else {
        // Generic: scale with factor
        data[field] = jitter(Math.round(baseVal * factor), 0.04);
      }
    }

    toInsert.push({
      influencerId,
      platform,
      weekKey,
      agencyId,
      data,
      notes: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

if (toInsert.length === 0) {
  console.log("Nothing to insert — all mock data already exists.");
} else {
  const res = await db.collection("weekly_entries").insertMany(toInsert);
  console.log(`\n✅ Inserted ${res.insertedCount} mock entries across W05–W14`);
}

await client.close();
