/**
 * Mongoose model for the `influencers` collection.
 *
 * Schema notes:
 *   - All influencers are created manually.
 *   - `handles` is an embedded sub-document with one optional string per
 *     platform key. Empty / missing means the influencer doesn't have an
 *     account on that platform; the dashboard still renders the section so
 *     the operator can enter weekly data when they do.
 *   - `agencyId` is the tenant boundary — every influencer belongs to
 *     exactly one agency, set at create time and immutable thereafter.
 *     All list/read endpoints filter by it.
 */
import "server-only";
import mongoose, { Schema } from "mongoose";

export interface InfluencerDoc {
  _id: mongoose.Types.ObjectId;
  agencyId: mongoose.Types.ObjectId;
  name: string;
  handles: {
    reddit?: string[] | null;
    instagram?: string[] | null;
    x?: string[] | null;
    onlyfans?: string | null;
  };
  /** Portal login username. Unique, lowercase, sparse (not all influencers need login). */
  loginUsername?: string | null;
  /** bcrypt hash of the portal login password. */
  loginPasswordHash?: string | null;
  /** Infloww creator ID used to sync OnlyFans subscriber count. */
  inflowwCreatorId?: string | null;
  /** Internal notes written by workers/admins — NOT shown to the influencer. */
  marketingNotes?: string | null;
  ofNotes?: string | null;
  /** Weekly tracker notes — editable by data-entry workers, shown in their portal. */
  trackerNotes?: string | null;
  /** Public URL of the influencer's avatar image (stored in Vercel Blob). */
  avatarUrl?: string | null;
  /** Manual sort order — lower = higher in the list. */
  sortOrder?: number;
  createdAt: Date;
  updatedAt: Date;
}

const InfluencerSchema = new Schema<InfluencerDoc>(
  {
    agencyId: {
      type: Schema.Types.ObjectId,
      ref: "Agency",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    handles: {
      reddit: { type: [String], default: [] },
      instagram: { type: [String], default: [] },
      x: { type: [String], default: [] },
      onlyfans: { type: String, default: null, trim: true },
    },
    loginUsername: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
      sparse: true,
      unique: true,
    },
    loginPasswordHash: { type: String, default: null },
    inflowwCreatorId: { type: String, default: null, trim: true },
    marketingNotes: { type: String, default: null },
    ofNotes: { type: String, default: null },
    trackerNotes: { type: String, default: null },
    avatarUrl: { type: String, default: null },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "influencers" },
);

export const InfluencerModel =
  (mongoose.models.Influencer as mongoose.Model<InfluencerDoc>) ||
  mongoose.model<InfluencerDoc>("Influencer", InfluencerSchema);
