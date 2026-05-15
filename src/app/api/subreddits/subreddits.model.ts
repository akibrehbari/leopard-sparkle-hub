/**
 * Mongoose models for the subreddits feature.
 *
 * Two collections:
 *
 *   `subreddits` — one document per tracked subreddit. Stores the human
 *   metadata (category, optional influencer link).
 *
 *   `subreddit_snapshots` — one document per (subreddit × ISO week PKT).
 *   Holds the manually entered numeric snapshot. The compound unique index
 *   makes the upsert idempotent: re-submitting the same week updates the
 *   existing row instead of creating duplicates.
 */
import "server-only";
import mongoose, { Schema } from "mongoose";

export interface SubredditDoc {
  _id: mongoose.Types.ObjectId;
  /** Tenant boundary — every subreddit lives inside exactly one agency. */
  agencyId: mongoose.Types.ObjectId;
  /** Lowercased bare name, e.g. "askreddit". The canonical lookup key. */
  name: string;
  /** Preserved-case display name, e.g. "AskReddit". For UI only. Defaults to name. */
  displayName?: string;
  /** Free-form, lowercased for grouping. Required to keep the filter useful. */
  category: string;
  /** Optional ref → influencers. Many-to-one (each subreddit has at most one owner). */
  influencerId: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const SubredditSchema = new Schema<SubredditDoc>(
  {
    agencyId: {
      type: Schema.Types.ObjectId,
      ref: "Agency",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    displayName: { type: String, trim: true },
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
  },
  { timestamps: true, collection: "subreddits" },
);

// Subreddit names are unique per agency, NOT globally — two different
// agencies can independently track r/askreddit without conflict.
SubredditSchema.index({ agencyId: 1, name: 1 }, { unique: true });
SubredditSchema.index({ influencerId: 1 });
SubredditSchema.index({ category: 1 });

export const SubredditModel =
  (mongoose.models.Subreddit as mongoose.Model<SubredditDoc>) ||
  mongoose.model<SubredditDoc>("Subreddit", SubredditSchema);

/* -------------------------------------------------------------------------- */

export interface SubredditSnapshotDoc {
  _id: mongoose.Types.ObjectId;
  /** Denormalized from the parent subreddit so per-agency queries are O(index). */
  agencyId: mongoose.Types.ObjectId;
  subredditId: mongoose.Types.ObjectId;
  /** ISO week key in PKT, e.g. "2026-W18". */
  weekKey: string;
  followers: number;
  contributions: number;
  weeklyVisits: number;
  createdAt: Date;
  updatedAt: Date;
}

const SubredditSnapshotSchema = new Schema<SubredditSnapshotDoc>(
  {
    agencyId: {
      type: Schema.Types.ObjectId,
      ref: "Agency",
      required: true,
      index: true,
    },
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
    followers: { type: Number, required: true, default: 0 },
    contributions: { type: Number, required: true, default: 0 },
    weeklyVisits: { type: Number, required: true, default: 0 },
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
