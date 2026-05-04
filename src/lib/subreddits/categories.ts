/**
 * Single source of truth for subreddit categories.
 *
 * Categories are deliberately curated — a free-form field encourages
 * typos ("fitness" / "Fitness" / "fit") that fragment the filter dropdown.
 * Adding a new category is a one-line change here; everything downstream
 * (dialogs, filters, table chips, server validation) reads from this array.
 *
 * Storage: the lowercase `key` is what we persist on the subreddit doc.
 * Display: callers should always render `label` (or pipe through
 * `categoryLabel(key)`) so multi-word categories format correctly.
 */

export interface SubredditCategoryDef {
  /** Lowercased canonical token, written to Mongo. */
  key: string;
  /** Human-readable label, shown in the UI. */
  label: string;
}

export const SUBREDDIT_CATEGORIES: readonly SubredditCategoryDef[] = [
  { key: "promo", label: "Promo / verification" },
  { key: "amateur", label: "Amateur" },
  { key: "cosplay", label: "Cosplay" },
  { key: "fitness", label: "Fitness" },
  { key: "fashion", label: "Fashion" },
  { key: "lifestyle", label: "Lifestyle" },
  { key: "alternative", label: "Alt / goth" },
  { key: "lingerie", label: "Lingerie" },
  { key: "couples", label: "Couples" },
  { key: "solo", label: "Solo" },
  { key: "feet", label: "Feet" },
  { key: "bbw", label: "BBW" },
  { key: "petite", label: "Petite" },
  { key: "milf", label: "MILF / mature" },
  { key: "nsfw", label: "NSFW" },
  { key: "general-nsfw", label: "General NSFW" },
  { key: "general-sfw", label: "General SFW" },
  { key: "local", label: "Local / regional" },
  { key: "other", label: "Other" },
] as const;

export const SUBREDDIT_CATEGORY_KEYS: readonly string[] =
  SUBREDDIT_CATEGORIES.map((c) => c.key);

export function isValidCategory(key: string): boolean {
  return SUBREDDIT_CATEGORY_KEYS.includes(key);
}

const LABEL_BY_KEY = new Map(
  SUBREDDIT_CATEGORIES.map((c) => [c.key, c.label] as const),
);

/**
 * Resolve a stored category key to its display label.
 * Falls back to the raw key (capitalized) so legacy data renders sanely
 * if the registry ever drops a value.
 */
export function categoryLabel(key: string | null | undefined): string {
  if (!key) return "—";
  const hit = LABEL_BY_KEY.get(key);
  if (hit) return hit;
  return key.charAt(0).toUpperCase() + key.slice(1);
}
