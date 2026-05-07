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
    reddit?: string | null;
    instagram?: string | null;
    x?: string | null;
    onlyfans?: string | null;
  };
  /** Portal login username. Unique, lowercase, sparse (not all influencers need login). */
  loginUsername?: string | null;
  /** bcrypt hash of the portal login password. */
  loginPasswordHash?: string | null;
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
      reddit: { type: String, default: null, trim: true },
      instagram: { type: String, default: null, trim: true },
      x: { type: String, default: null, trim: true },
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
  },
  { timestamps: true, collection: "influencers" },
);

export const InfluencerModel =
  (mongoose.models.Influencer as mongoose.Model<InfluencerDoc>) ||
  mongoose.model<InfluencerDoc>("Influencer", InfluencerSchema);
