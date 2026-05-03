"use client";

/**
 * Section heading badge for a social platform.
 *
 * Renders the brand icon in its brand color and a label, used as a small
 * banner above each platform's card cluster. Lives outside the platform
 * registry on purpose: the registry is server-shareable (pure data) while
 * this file is React-only.
 */

import type { ComponentType, SVGProps } from "react";
import { FaInstagram, FaRedditAlien, FaXTwitter } from "react-icons/fa6";
import { SiOnlyfans } from "react-icons/si";

import type { PlatformKey } from "@/lib/platforms/registry";

interface IconConfig {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  /** Brand color used for the icon background. */
  color: string;
  /** Foreground color for the icon (defaults to white). */
  fg?: string;
}

const ICONS: Record<PlatformKey, IconConfig> = {
  onlyfans: { Icon: SiOnlyfans, label: "OnlyFans", color: "#00AFF0" },
  reddit: { Icon: FaRedditAlien, label: "Reddit", color: "#FF4500" },
  instagram: { Icon: FaInstagram, label: "Instagram", color: "#E4405F" },
  // X uses a black tile with white icon — the cleanest brand mark on dark themes.
  x: { Icon: FaXTwitter, label: "X", color: "#000000", fg: "#FFFFFF" },
};

interface Props {
  platform: PlatformKey;
  /** Optional override / extra label suffix (e.g. "(formerly Twitter)"). */
  suffix?: string;
}

export function PlatformBadge({ platform, suffix }: Props) {
  const { Icon, label, color, fg } = ICONS[platform];
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <span
        className="size-7 rounded-lg grid place-items-center shadow-sm border border-border"
        style={{ background: color, color: fg ?? "#FFFFFF" }}
        aria-hidden
      >
        <Icon className="size-4" />
      </span>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
        {label}
        {suffix && (
          <span className="ml-1.5 text-muted-foreground font-normal normal-case tracking-normal text-xs">
            {suffix}
          </span>
        )}
      </h2>
    </div>
  );
}
