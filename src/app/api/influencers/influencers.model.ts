/**
 * Mongoose model for the `influencers` collection.
 *
 * Schema notes:
 *   - All influencers are created manually now (the Infloww sync was removed).
 *   - `handles` is an embedded sub-document with one optional string per
 *     platform key. Empty / missing means the influencer doesn't have an
 *     account on that platform; the dashboard still renders the section so
 *     the operator can enter weekly data when they do.
 *   - Existing documents in production may still carry deprecated keys
 *     (`inflowwCreatorId`, `inflowwUserName`, `isManual`). They're harmless
 *     leftovers — the model just stops reading them. Drop the fields out of
 *     band if you want a clean collection.
 */
import "server-only";
import mongoose, { Schema } from "mongoose";

export interface InfluencerDoc {
  _id: mongoose.Types.ObjectId;
  name: string;
  handles: {
    reddit?: string | null;
    instagram?: string | null;
    x?: string | null;
    onlyfans?: string | null;
  };
  createdAt: Date;
  updatedAt: Date;
}

const InfluencerSchema = new Schema<InfluencerDoc>(
  {
    name: { type: String, required: true, trim: true },
    handles: {
      reddit: { type: String, default: null, trim: true },
      instagram: { type: String, default: null, trim: true },
      x: { type: String, default: null, trim: true },
      onlyfans: { type: String, default: null, trim: true },
    },
  },
  { timestamps: true, collection: "influencers" },
);

export const InfluencerModel =
  (mongoose.models.Influencer as mongoose.Model<InfluencerDoc>) ||
  mongoose.model<InfluencerDoc>("Influencer", InfluencerSchema);
