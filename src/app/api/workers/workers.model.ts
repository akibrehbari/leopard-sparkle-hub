import "server-only";
import mongoose, { Schema } from "mongoose";

export interface WorkerDoc {
  _id: mongoose.Types.ObjectId;
  agencyId: mongoose.Types.ObjectId;
  name: string;
  loginUsername: string;
  loginPasswordHash: string;
  /** Influencer IDs this worker is assigned to manage. */
  assignedInfluencerIds: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const WorkerSchema = new Schema<WorkerDoc>(
  {
    agencyId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true, trim: true },
    loginUsername: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    loginPasswordHash: { type: String, required: true },
    assignedInfluencerIds: {
      type: [Schema.Types.ObjectId],
      default: [],
    },
  },
  { timestamps: true, collection: "workers" },
);

// Username must be unique within an agency, not globally.
WorkerSchema.index({ agencyId: 1, loginUsername: 1 }, { unique: true });

export const WorkerModel =
  (mongoose.models.Worker as mongoose.Model<WorkerDoc>) ||
  mongoose.model<WorkerDoc>("Worker", WorkerSchema);
