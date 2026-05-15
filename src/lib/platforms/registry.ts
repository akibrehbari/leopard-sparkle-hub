/**
 * Platform registry — the single source of truth for the schema of each
 * tracked social platform.
 *
 * To add a new platform:
 *   1. Add an entry to PLATFORMS below.
 *   2. Add the key to PLATFORM_KEYS.
 *   3. Done. The form, validation, and tracker columns auto-derive.
 *
 * Field semantics:
 *   - kind="count" — non-negative integer; stored as-is.
 *   - kind="currencyCents" — entered in dollars (with cents), stored as
 *     integer cents to avoid float drift. Display layer is responsible for
 *     converting back to USD via centsToUsd().
 *   - cumulative=true — the value entered is a running total "as of this
 *     week" (e.g., total followers). Renderers compute weekly deltas by
 *     subtracting the prior cumulative reading. cumulative=false means the
 *     value is per-week (e.g., revenue earned this week).
 */

export type PlatformKey = "reddit" | "instagram" | "x" | "onlyfans";

export const PLATFORM_KEYS: PlatformKey[] = [
  "reddit",
  "instagram",
  "x",
  "onlyfans",
];

/**
 * Platforms that drive customers TO OnlyFans. Used by the OnlyFans section
 * to know how to break down per-source revenue/spend.
 */
export type AcquisitionPlatformKey = Exclude<PlatformKey, "onlyfans">;

export const ACQUISITION_PLATFORM_KEYS: AcquisitionPlatformKey[] = [
  "reddit",
  "instagram",
  "x",
];

export interface PlatformField {
  key: string;
  label: string;
  /** Storage + input behavior. Defaults to "count". */
  kind?: "count" | "currencyCents";
  required?: boolean;
  /** When true, the value is a running total; renderers derive weekly deltas. */
  cumulative?: boolean;
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

/* -------------------------------------------------------------------------- */
/*  OnlyFans field generation                                                 */
/*                                                                            */
/*  OnlyFans is the single monetization platform. For every acquisition       */
/*  source we capture two per-week dollar values: revenue earned + total      */
/*  spend. We generate the field list rather than write it out manually so    */
/*  adding a new acquisition platform automatically extends OnlyFans too.     */
/* -------------------------------------------------------------------------- */

const SOURCE_LABEL: Record<AcquisitionPlatformKey, string> = {
  reddit: "Reddit",
  instagram: "Instagram",
  x: "X",
};

function onlyFansFields(): PlatformField[] {
  const out: PlatformField[] = [
    {
      key: "subscribers",
      label: "Total subscribers",
      kind: "count",
      cumulative: true,
      hint: "Total active subscribers on OnlyFans as of this week.",
    },
  ];
  for (const src of ACQUISITION_PLATFORM_KEYS) {
    out.push({
      key: `subs_${src}`,
      label: `New subs from ${SOURCE_LABEL[src]}`,
      kind: "count",
      hint: `Subscribers gained this week from ${SOURCE_LABEL[src]}.`,
    });
    out.push({
      key: `claims_${src}`,
      label: `Claims from ${SOURCE_LABEL[src]}`,
      kind: "count",
      hint: `Total link/promo claims from ${SOURCE_LABEL[src]} this week.`,
    });
    out.push({
      key: `revenue_${src}`,
      label: `Revenue from ${SOURCE_LABEL[src]}`,
      kind: "currencyCents",
      hint: `Money earned this week from leads that came via ${SOURCE_LABEL[src]}.`,
    });
    out.push({
      key: `spend_${src}`,
      label: `Total spend on ${SOURCE_LABEL[src]}`,
      kind: "currencyCents",
      hint: `All-in cost for ${SOURCE_LABEL[src]} this week (ads, content, agency fees, etc.).`,
    });
  }
  return out;
}

/**
 * Helper: build a field key for OnlyFans (e.g. revenue/spend × source).
 * Keep the form/derive layers decoupled from the literal key strings.
 */
export function onlyFansFieldKey(
  metric: "revenue" | "spend" | "subs" | "claims",
  source: AcquisitionPlatformKey,
): string {
  return `${metric}_${source}`;
}

export const PLATFORMS: Record<PlatformKey, PlatformDefinition> = {
  reddit: {
    key: "reddit",
    label: "Reddit",
    short: "R",
    color: "#FF4500",
    fields: [
      {
        key: "followers",
        label: "Total followers",
        kind: "count",
        cumulative: true,
        required: true,
        hint: "Followers on the influencer's Reddit profile, as of this week.",
      },
      {
        key: "karma",
        label: "Total karma",
        kind: "count",
        cumulative: true,
        hint: "All-time karma showing on the profile.",
      },
      {
        key: "posts",
        label: "Total posts published",
        kind: "count",
        cumulative: true,
        hint: "Lifetime post count on the profile.",
      },
    ],
  },
  instagram: {
    key: "instagram",
    label: "Instagram",
    short: "IG",
    color: "#E4405F",
    fields: [
      {
        key: "followers",
        label: "Total followers",
        kind: "count",
        cumulative: true,
        required: true,
        hint: "Follower count showing on the profile, as of this week.",
      },
      {
        key: "posts",
        label: "Total posts published",
        kind: "count",
        cumulative: true,
        hint: "Lifetime post count on the profile.",
      },
    ],
  },
  x: {
    key: "x",
    label: "X",
    short: "X",
    color: "#000000",
    fields: [
      {
        key: "followers",
        label: "Total followers",
        kind: "count",
        cumulative: true,
        required: true,
        hint: "Follower count showing on the profile, as of this week.",
      },
      {
        key: "posts",
        label: "Total posts published",
        kind: "count",
        cumulative: true,
        hint: "Lifetime post count on the profile.",
      },
    ],
  },
  onlyfans: {
    key: "onlyfans",
    label: "OnlyFans",
    short: "OF",
    color: "#00AFF0",
    fields: onlyFansFields(),
  },
};

export function isValidPlatform(key: string): key is PlatformKey {
  return (PLATFORM_KEYS as string[]).includes(key);
}

/* -------------------------------------------------------------------------- */
/*  Validation                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Validate (and coerce) a posted entry payload against the platform's field
 * schema. Returns the cleaned data (always integers — counts as-is, currency
 * already converted to cents) or an error message.
 *
 * Currency input contract:
 *   The client may send either a dollar value (e.g. `12.34`) or an integer
 *   cents value (e.g. `1234`) — we treat any number as dollars and convert
 *   to cents internally. To send an exact cents value, use a string like
 *   "1234.00".
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
  const fieldByKey = new Map(def.fields.map((f) => [f.key, f] as const));

  for (const [k, raw] of Object.entries(payload as Record<string, unknown>)) {
    const field = fieldByKey.get(k);
    if (!field) continue;
    if (raw === undefined || raw === null || raw === "") continue;

    const n = Number(raw);
    if (!Number.isFinite(n)) {
      return { ok: false, error: `Field "${field.label}" must be a number` };
    }
    if (n < 0) {
      return { ok: false, error: `Field "${field.label}" must not be negative` };
    }

    if ((field.kind ?? "count") === "currencyCents") {
      // Dollars in → cents out; cap at 2 decimal places to avoid floats like
      // 12.345 sneaking into Mongo as 1234.4999999.
      out[k] = Math.round(n * 100);
    } else {
      out[k] = Math.round(n);
    }
  }

  for (const field of def.fields) {
    if (field.required && out[field.key] === undefined) {
      return { ok: false, error: `Field "${field.label}" is required` };
    }
  }
  return { ok: true, data: out };
}
