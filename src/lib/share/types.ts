/**
 * Shared types for the public /share/[id] feature.
 *
 * SharePayload is the single, frozen blob that the server hands to the
 * read-only dashboard renderer. It deliberately mirrors the authenticated
 * dashboard's data shape so the same components can render it without
 * conditional branching.
 */

import type {
  InflowwLink,
  InflowwLinkType,
  InflowwRefund,
  InflowwTransaction,
} from "@/lib/infloww/types";
import type { Influencer } from "@/lib/influencers/types";
import type { WeeklyEntry } from "@/lib/entries/types";
import type { PlatformDefinition, PlatformKey } from "@/lib/platforms/registry";
import type { DashboardRange } from "@/lib/utils/range";

export interface SharePayload {
  influencer: Influencer;
  range: DashboardRange;
  /** Inclusive ISO timestamps describing the range window for display. */
  window: { startISO: string; endISO: string };
  /** Present only when the influencer has an inflowwCreatorId. */
  infloww: {
    transactions: InflowwTransaction[];
    refunds: InflowwRefund[];
    links: Partial<Record<InflowwLinkType, InflowwLink[]>>;
  } | null;
  /** Always present, one entry per platform. */
  entries: Partial<Record<PlatformKey, WeeklyEntry[]>>;
  platforms: Record<PlatformKey, PlatformDefinition>;
  generatedAt: string;
}
