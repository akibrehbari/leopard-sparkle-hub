/**
 * Mongoose model for the `weekly_entries` collection.
 *
 * One document per (influencerId, platform, weekKey). The unique compound
 * index lets us treat upserts as idempotent: if an entry already exists for
 * that (influencer, platform, week), we update it; otherwise we create.
 *
 * `data` is a free-form Map so that adding a new platform field doesn't
 * require a schema change. Validation is enforced in the controller against
 * the platform registry.
 */
import "server-only";
import mongoose, { Schema } from "mongoose";
import { PLATFORM_KEYS } from "@/lib/platforms/registry";

export interface WeeklyEntryDoc {
  _id: mongoose.Types.ObjectId;
  influencerId: mongoose.Types.ObjectId;
  platform: string;
  weekKey: string;
  data: Map<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

const WeeklyEntrySchema = new Schema<WeeklyEntryDoc>(
  {
    influencerId: {
      type: Schema.Types.ObjectId,
      ref: "Influencer",
      required: true,
      index: true,
    },
    platform: {
      type: String,
      required: true,
      enum: PLATFORM_KEYS,
    },
    weekKey: {
      type: String,
      required: true,
      match: /^\d{4}-W\d{2}$/,
    },
    data: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { timestamps: true, collection: "weekly_entries" },
);

WeeklyEntrySchema.index(
  { influencerId: 1, platform: 1, weekKey: 1 },
  { unique: true },
);

export const WeeklyEntryModel =
  (mongoose.models.WeeklyEntry as mongoose.Model<WeeklyEntryDoc>) ||
  mongoose.model<WeeklyEntryDoc>("WeeklyEntry", WeeklyEntrySchema);
