/**
 * Mongoose model for the `influencers` collection.
 *
 * Schema notes:
 *   - inflowwCreatorId is a sparse unique index. Multiple manual influencers
 *     can have null/missing it, but no two synced ones can share an Infloww ID.
 *   - handles is an embedded sub-document with optional reddit/instagram strings.
 */
import "server-only";
import mongoose, { Schema } from "mongoose";

export interface InfluencerDoc {
  _id: mongoose.Types.ObjectId;
  name: string;
  inflowwCreatorId?: string | null;
  inflowwUserName?: string | null;
  handles: {
    reddit?: string | null;
    instagram?: string | null;
  };
  isManual: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const InfluencerSchema = new Schema<InfluencerDoc>(
  {
    name: { type: String, required: true, trim: true },
    inflowwCreatorId: {
      type: String,
      default: null,
      index: { unique: true, sparse: true },
    },
    inflowwUserName: { type: String, default: null },
    handles: {
      reddit: { type: String, default: null, trim: true },
      instagram: { type: String, default: null, trim: true },
    },
    isManual: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, collection: "influencers" },
);

export const InfluencerModel =
  (mongoose.models.Influencer as mongoose.Model<InfluencerDoc>) ||
  mongoose.model<InfluencerDoc>("Influencer", InfluencerSchema);
