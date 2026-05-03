/**
 * Platform registry — the single source of truth for the schema of each
 * tracked social platform.
 *
 * To add a new platform:
 *   1. Add an entry to PLATFORMS below.
 *   2. Add the key to PLATFORM_KEYS.
 *   3. Done. The form, validation, and tracker columns auto-derive.
 */

export type PlatformKey = "reddit" | "instagram";

export const PLATFORM_KEYS: PlatformKey[] = ["reddit", "instagram"];

export interface PlatformField {
  key: string;
  label: string;
  /** All numeric for now; extend with "string" / "decimal" / "percent" later. */
  type: "int";
  required?: boolean;
  /** Optional helper text shown beneath the input. */
  hint?: string;
}

export interface PlatformDefinition {
  key: PlatformKey;
  label: string;
  /** Short display label (1–3 chars) for compact tracker headers. */
  short: string;
  /** Brand color used for pills / charts. */
  color: string;
  fields: PlatformField[];
}

export const PLATFORMS: Record<PlatformKey, PlatformDefinition> = {
  reddit: {
    key: "reddit",
    label: "Reddit",
    short: "R",
    color: "#FF4500",
    fields: [
      { key: "karma", label: "Total karma", type: "int", required: true },
      { key: "postKarma", label: "Post karma", type: "int" },
      { key: "commentKarma", label: "Comment karma", type: "int" },
      {
        key: "newSubscribers",
        label: "New subreddit subscribers this week",
        type: "int",
      },
    ],
  },
  instagram: {
    key: "instagram",
    label: "Instagram",
    short: "IG",
    color: "#E4405F",
    fields: [
      { key: "followers", label: "Followers", type: "int", required: true },
      { key: "following", label: "Following", type: "int" },
      { key: "posts", label: "Total posts", type: "int" },
      {
        key: "newFollowers",
        label: "New followers this week",
        type: "int",
      },
    ],
  },
};

export function isValidPlatform(key: string): key is PlatformKey {
  return (PLATFORM_KEYS as string[]).includes(key);
}

/**
 * Validate (and coerce to numbers) a posted entry payload against the
 * platform's field schema. Returns either the cleaned payload or an error
 * message describing what's wrong.
 */
export function validateEntryData(
  platform: PlatformKey,
  payload: unknown,
): { ok: true; data: Record<string, number> } | { ok: false; error: string } {
  if (typeof payload !== "object" || payload === null) {
    return { ok: false, error: "data must be an object" };
  }
  const def = PLATFORMS[platform];
  const out: Record<string, number> = {};
  const allowed = new Set(def.fields.map((f) => f.key));

  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    if (!allowed.has(k)) continue;
    if (v === undefined || v === null || v === "") continue;
    const n = Number(v);
    if (!Number.isFinite(n)) {
      return { ok: false, error: `Field "${k}" must be a number` };
    }
    if (n < 0) {
      return { ok: false, error: `Field "${k}" must not be negative` };
    }
    out[k] = Math.round(n);
  }

  for (const field of def.fields) {
    if (field.required && out[field.key] === undefined) {
      return { ok: false, error: `Field "${field.label}" is required` };
    }
  }
  return { ok: true, data: out };
}
