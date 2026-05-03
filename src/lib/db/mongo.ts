/**
 * Server-only Mongoose connection.
 *
 * Two things we have to handle that aren't obvious:
 *   1. Next.js dev-mode hot-reload creates a fresh module instance on every
 *      file change, which would leak Mongo connections. We cache the
 *      connection (and the connecting Promise) on `globalThis`.
 *   2. Multiple route handlers may call this concurrently on a cold start;
 *      we share the in-flight Promise so we only ever open one connection.
 *
 * Usage from a controller:
 *   import { connectMongo } from "@/lib/db/mongo";
 *   await connectMongo();
 *   const docs = await InfluencerModel.find();
 */
import "server-only";
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;

interface MongoCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

const globalForMongo = globalThis as unknown as { __mongoCache?: MongoCache };
const cache: MongoCache = globalForMongo.__mongoCache ?? { conn: null, promise: null };
globalForMongo.__mongoCache = cache;

export async function connectMongo(): Promise<typeof mongoose> {
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Add it to your environment (e.g. .env.local).",
    );
  }
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    cache.promise = mongoose.connect(uri, {
      bufferCommands: false,
    });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}
