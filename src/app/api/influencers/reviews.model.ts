import "server-only";
import mongoose, { Schema } from "mongoose";

export interface InfluencerReviewDoc {
  _id: mongoose.Types.ObjectId;
  agencyId: mongoose.Types.ObjectId;
  influencerId: mongoose.Types.ObjectId;
  authorName: string;
  content: string;
  weekKey?: string | null;
  rating?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const InfluencerReviewSchema = new Schema<InfluencerReviewDoc>(
  {
    agencyId: { type: Schema.Types.ObjectId, required: true, index: true },
    influencerId: { type: Schema.Types.ObjectId, required: true, index: true },
    authorName: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    weekKey: { type: String, default: null },
    rating: { type: Number, min: 1, max: 5, default: null },
  },
  { timestamps: true, collection: "influencer_reviews" },
);

export const InfluencerReviewModel =
  (mongoose.models.InfluencerReview as mongoose.Model<InfluencerReviewDoc>) ||
  mongoose.model<InfluencerReviewDoc>("InfluencerReview", InfluencerReviewSchema);
