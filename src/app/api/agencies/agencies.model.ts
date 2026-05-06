/**
 * Mongoose model for the `agencies` collection.
 *
 * Each agency owns a tenant slice of the database — every influencer,
 * weekly entry, subreddit, and snapshot carries an `agencyId` that points
 * here. Hard cross-agency isolation is enforced server-side; clients never
 * see records outside the active agency.
 *
 * Authentication: each agency carries one `ownerUsername` + bcrypt-hashed
 * `ownerPasswordHash`. Logging in with these credentials issues a JWT pinned
 * to the agency's `_id`, giving the holder read-only access to their slice
 * (see `lib/auth/roles.ts` → `agency_owner`).
 */
import "server-only";
import mongoose, { Schema } from "mongoose";

/**
 * Outbound links surfaced in the topbar for admin + agency-owner sessions.
 * Editors never see these (data-entry teammates don't need shortcuts to
 * the agency's monetization channels).
 *
 * Each value is either a full URL string or null when unset. Validation
 * (must parse as URL with http/https) is enforced in the controller.
 */
export interface AgencyLinks {
  onlyfans: string | null;
  infloww: string | null;
  instagram: string | null;
  website: string | null;
}

export interface AgencyDoc {
  _id: mongoose.Types.ObjectId;
  /** Display name. Trimmed; uniqueness is enforced case-insensitively. */
  name: string;
  /**
   * Login handle for the agency owner. Stored lowercased + trimmed and
   * uniquely indexed across all agencies + env credential slots (the env
   * uniqueness is policed in the controller, not here).
   */
  ownerUsername: string;
  /** bcrypt hash of the owner password. Never compared in plaintext. */
  ownerPasswordHash: string;
  links: AgencyLinks;
  createdAt: Date;
  updatedAt: Date;
}

const AgencySchema = new Schema<AgencyDoc>(
  {
    name: { type: String, required: true, trim: true },
    ownerUsername: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    ownerPasswordHash: { type: String, required: true },
    links: {
      onlyfans: { type: String, default: null, trim: true },
      infloww: { type: String, default: null, trim: true },
      instagram: { type: String, default: null, trim: true },
      website: { type: String, default: null, trim: true },
    },
  },
  { timestamps: true, collection: "agencies" },
);

// Case-insensitive unique name to avoid "Acme" vs "acme" duplicates that
// would confuse the agency switcher.
AgencySchema.index(
  { name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);
AgencySchema.index({ ownerUsername: 1 }, { unique: true });

export const AgencyModel =
  (mongoose.models.Agency as mongoose.Model<AgencyDoc>) ||
  mongoose.model<AgencyDoc>("Agency", AgencySchema);
