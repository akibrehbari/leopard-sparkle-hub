#!/usr/bin/env node
/**
 * Wipe every application collection from the configured Mongo database.
 *
 * Removes documents from:
 *   - influencers
 *   - weekly_entries
 *   - subreddits
 *   - subreddit_snapshots
 *
 * Indexes are preserved (we re-`deleteMany` rather than `drop()`), so the
 * next app start doesn't have to re-create them. Auth, env, and any
 * collection not in the list above are untouched.
 *
 * Usage:
 *   node --env-file=.env scripts/wipe-db.mjs --yes
 *
 * The `--yes` flag is required to prevent accidental wipes in CI / shells
 * where `node --env-file=.env scripts/wipe-db.mjs` might be re-run from
 * shell history.
 */

import mongoose from "mongoose";

const COLLECTIONS = [
  "influencers",
  "weekly_entries",
  "subreddits",
  "subreddit_snapshots",
];

function bail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
if (!args.has("--yes")) {
  bail(
    "Refusing to run without --yes. This will DELETE every document from " +
      `[${COLLECTIONS.join(", ")}].\n  Re-run as: node --env-file=.env scripts/wipe-db.mjs --yes`,
  );
}

const uri = process.env.MONGODB_URI;
if (!uri) bail("MONGODB_URI is not set in the environment.");

// Hide credentials from the log line but still show which cluster + db
// we're targeting so the operator can sanity-check before pulling the
// trigger. Mongo URIs look like
// "mongodb+srv://user:pass@cluster.mongodb.net/dbname?...".
function summarizeUri(raw) {
  try {
    const u = new URL(raw);
    const db = (u.pathname || "/").slice(1) || "(default)";
    return `${u.protocol}//${u.hostname}/${db}`;
  } catch {
    return "(unparseable URI)";
  }
}

console.log(`→ Connecting to ${summarizeUri(uri)}`);
await mongoose.connect(uri, { bufferCommands: false });

const dbName = mongoose.connection.db?.databaseName ?? "(unknown)";
console.log(`→ Connected. Database: ${dbName}`);
console.log(`→ Wiping ${COLLECTIONS.length} collection(s)...`);

const results = [];
for (const name of COLLECTIONS) {
  try {
    const coll = mongoose.connection.db.collection(name);
    const before = await coll.countDocuments();
    if (before === 0) {
      console.log(`  · ${name}: already empty`);
      results.push({ name, deleted: 0, before: 0 });
      continue;
    }
    const res = await coll.deleteMany({});
    console.log(`  ✓ ${name}: deleted ${res.deletedCount}/${before}`);
    results.push({ name, deleted: res.deletedCount, before });
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    results.push({ name, deleted: 0, error: err.message });
  }
}

await mongoose.disconnect();

const totalDeleted = results.reduce((acc, r) => acc + (r.deleted || 0), 0);
const failures = results.filter((r) => r.error);
console.log(`→ Done. Deleted ${totalDeleted} document(s) total.`);
if (failures.length > 0) {
  console.error(`→ ${failures.length} collection(s) failed; see errors above.`);
  process.exit(1);
}
