"use client";

/**
 * Outbound link icons for the active agency, rendered to the left of the
 * dashboard topbar search input.
 *
 * Visibility:
 *   - admin           → see the active agency's links (whatever they
 *                       switched to via the agency dropdown).
 *   - agency_owner    → see their own agency's links (JWT-bound).
 *   - editor          → hidden entirely. Data-entry teammates don't
 *                       need shortcuts to revenue / brand surfaces.
 *   - unauthenticated → hidden.
 *
 * Each icon links to the configured URL with `target=_blank` and
 * `rel="noopener noreferrer"`. Slots without a URL configured are
 * skipped — no greyed-out placeholders, the row just shrinks. When no
 * slot is configured the component renders nothing.
 */

import { Globe, Link2 } from "lucide-react";
import { FaInstagram } from "react-icons/fa6";
import { SiOnlyfans } from "react-icons/si";

import { useActiveAgency } from "@/lib/agencies/agencies.hooks";
import { useSession } from "@/lib/auth/auth.hooks";
import { isAdmin, isAgencyOwner } from "@/lib/auth/roles";
import {
  AGENCY_LINK_KEYS,
  AGENCY_LINK_LABELS,
  type AgencyLinkKey,
} from "@/lib/agencies/types";

import type { ComponentType, SVGProps } from "react";

interface IconConfig {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Background tint for the chip — brand color where there is one. */
  bg: string;
  /** Foreground/icon color. */
  fg: string;
}

const ICON_CONFIG: Record<AgencyLinkKey, IconConfig> = {
  onlyfans: { Icon: SiOnlyfans, bg: "#00AFF0", fg: "#FFFFFF" },
  // Infloww has no widely-recognized brand mark in our icon set — use a
  // neutral link chip with the agency's accent. Keeps the row legible
  // without inventing a fake mark.
  infloww: { Icon: Link2, bg: "#7C3AED", fg: "#FFFFFF" },
  instagram: { Icon: FaInstagram, bg: "#E4405F", fg: "#FFFFFF" },
  website: { Icon: Globe, bg: "#0F172A", fg: "#FFFFFF" },
};

export function AgencyTopbarLinks() {
  const { data: session } = useSession();
  const allowed = isAdmin(session?.role) || isAgencyOwner(session?.role);
  // The hook is cheap enough to always run, but gating the network call
  // on the role keeps editors from issuing a request whose payload they
  // would never display.
  const { data: agency } = useActiveAgency({ enabled: allowed });

  if (!allowed) return null;
  if (!agency) return null;

  const links = agency.links;
  const present = AGENCY_LINK_KEYS.filter(
    (k) => typeof links[k] === "string" && (links[k] as string).length > 0,
  );
  if (present.length === 0) return null;

  return (
    <div
      className="hidden md:flex items-center gap-1.5"
      aria-label={`${agency.name} quick links`}
    >
      {present.map((key) => {
        const url = links[key] as string;
        const { Icon, bg, fg } = ICON_CONFIG[key];
        const label = `${AGENCY_LINK_LABELS[key]} – ${agency.name}`;
        return (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={label}
            aria-label={label}
            className="size-9 rounded-lg grid place-items-center border border-border shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            style={{ background: bg, color: fg }}
          >
            <Icon className="size-4" />
          </a>
        );
      })}
    </div>
  );
}
