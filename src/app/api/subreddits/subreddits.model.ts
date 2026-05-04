/**
 * Mongoose models for the subreddits feature.
 *
 * Two collections:
 *
 *   `subreddits` — one document per tracked subreddit. Stores the human
 *   metadata (category, optional influencer link, cached description).
 *
 *   `subreddit_snapshots` — one document per (subreddit × ISO week PKT).
 *   Holds the numeric snapshot the Sunday sync writes. The compound unique
 *   index makes the upsert idempotent: re-syncing the same Sunday updates
 *   the existing row instead of creating duplicates.
 */
import "server-only";
import mongoose, { Schema } from "mongoose";

export interface SubredditDoc {
  _id: mongoose.Types.ObjectId;
  /** Lowercased bare name, e.g. "askreddit". The canonical lookup key. */
  name: string;
  /** Reddit's preserved-case display name, e.g. "AskReddit". For UI only. */
  displayName: string;
  /** Free-form, lowercased for grouping. Required to keep the filter useful. */
  category: string;
  /** Optional ref → influencers. Many-to-one (each subreddit has at most one owner). */
  influencerId: mongoose.Types.ObjectId | null;
  /** Cached from Reddit's `public_description` so we can render without a fetch. */
  description: string | null;
  over18: boolean;
  /** Last successful sync timestamp; null until the first sync completes. */
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const SubredditSchema = new Schema<SubredditDoc>(
  {
    name: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    displayName: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    influencerId: {
      type: Schema.Types.ObjectId,
      ref: "Influencer",
      default: null,
    },
    description: { type: String, default: null },
    over18: { type: Boolean, default: false },
    lastSyncedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "subreddits" },
);

SubredditSchema.index({ name: 1 }, { unique: true });
SubredditSchema.index({ influencerId: 1 });
SubredditSchema.index({ category: 1 });

export const SubredditModel =
  (mongoose.models.Subreddit as mongoose.Model<SubredditDoc>) ||
  mongoose.model<SubredditDoc>("Subreddit", SubredditSchema);

/* -------------------------------------------------------------------------- */

export interface SubredditTopPost {
  title: string;
  score: number;
  url: string;
  permalink: string;
  author: string;
}

export interface SubredditSnapshotDoc {
  _id: mongoose.Types.ObjectId;
  subredditId: mongoose.Types.ObjectId;
  /** ISO week key in PKT, e.g. "2026-W18". */
  weekKey: string;
  subscribers: number;
  activeUsers: number | null;
  postsLast7d: number;
  topPost: SubredditTopPost | null;
  syncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TopPostSchema = new Schema<SubredditTopPost>(
  {
    title: { type: String, required: true },
    score: { type: Number, required: true },
    url: { type: String, required: true },
    permalink: { type: String, required: true },
    author: { type: String, required: true },
  },
  { _id: false },
);

const SubredditSnapshotSchema = new Schema<SubredditSnapshotDoc>(
  {
    subredditId: {
      type: Schema.Types.ObjectId,
      ref: "Subreddit",
      required: true,
    },
    weekKey: {
      type: String,
      required: true,
      match: /^\d{4}-W\d{2}$/,
    },
    subscribers: { type: Number, required: true, default: 0 },
    activeUsers: { type: Number, default: null },
    postsLast7d: { type: Number, required: true, default: 0 },
    topPost: { type: TopPostSchema, default: null },
    syncedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true, collection: "subreddit_snapshots" },
);

SubredditSnapshotSchema.index(
  { subredditId: 1, weekKey: 1 },
  { unique: true },
);
SubredditSnapshotSchema.index({ weekKey: 1 });

export const SubredditSnapshotModel =
  (mongoose.models.SubredditSnapshot as mongoose.Model<SubredditSnapshotDoc>) ||
  mongoose.model<SubredditSnapshotDoc>(
    "SubredditSnapshot",
    SubredditSnapshotSchema,
  );
