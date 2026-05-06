"use client";

/**
 * Shared subform for the four agency outbound links surfaced in the
 * dashboard topbar (admin + agency-owner sessions only).
 *
 * Lives outside the Add/Edit dialogs so both share identical layout,
 * placeholders and validation hints. The parent owns the values and the
 * setter — this component is fully controlled.
 *
 * URL validation is enforced server-side; here we only do a permissive
 * "looks like a URL" check to flag obvious mistakes early. An empty
 * string is treated as "clear this link" by the backend.
 */

import { Globe, Link2 } from "lucide-react";
import { FaInstagram } from "react-icons/fa6";
import { SiOnlyfans } from "react-icons/si";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AGENCY_LINK_KEYS,
  AGENCY_LINK_LABELS,
  type AgencyLinkKey,
  type AgencyLinks,
} from "@/lib/agencies/types";
import { cn } from "@/lib/utils";

import type { ComponentType, SVGProps } from "react";

/** Form state for the four link slots. Empty string == "no link set". */
export type AgencyLinksFormState = Record<AgencyLinkKey, string>;

interface Props {
  /** Current form state keyed by link slot. Empty string = unset. */
  values: AgencyLinksFormState;
  /** Called with the new value for a single slot. Empty string clears it. */
  onChange: (key: AgencyLinkKey, value: string) => void;
  /** Optional id prefix to keep multiple instances in the same DOM unique. */
  idPrefix?: string;
}

const ICONS: Record<
  AgencyLinkKey,
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  onlyfans: SiOnlyfans,
  infloww: Link2,
  instagram: FaInstagram,
  website: Globe,
};

const PLACEHOLDERS: Record<AgencyLinkKey, string> = {
  onlyfans: "https://onlyfans.com/your-handle",
  infloww: "https://app.infloww.com/...",
  instagram: "https://instagram.com/your-handle",
  website: "https://your-site.com",
};

export function AgencyLinksFields({
  values,
  onChange,
  idPrefix = "ag-link",
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Outbound links
        </Label>
        <span className="text-[11px] text-muted-foreground">
          Shown in topbar to admins & this agency&apos;s owner
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {AGENCY_LINK_KEYS.map((key) => {
          const Icon = ICONS[key];
          const id = `${idPrefix}-${key}`;
          const value = values[key];
          const looksValid =
            value.length === 0 || /^https?:\/\//i.test(value.trim());
          return (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={id} className="flex items-center gap-1.5">
                <Icon className="size-3.5 text-muted-foreground" />
                {AGENCY_LINK_LABELS[key]}
              </Label>
              <Input
                id={id}
                type="url"
                inputMode="url"
                value={value}
                onChange={(e) => onChange(key, e.target.value)}
                placeholder={PLACEHOLDERS[key]}
                className={cn(
                  "text-xs",
                  !looksValid && "border-destructive/60 focus-visible:ring-destructive/30",
                )}
                autoComplete="off"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Strip the `links` partial down to keys whose value actually changed
 * relative to a baseline. Used by the edit dialog so we only PATCH what
 * the admin touched (avoids spurious history churn).
 */
export function diffLinks(
  baseline: AgencyLinks,
  next: AgencyLinksFormState,
): Partial<AgencyLinks> {
  const out: Partial<AgencyLinks> = {};
  for (const key of AGENCY_LINK_KEYS) {
    const before = (baseline[key] ?? "").trim();
    const after = next[key].trim();
    if (before !== after) {
      out[key] = after.length === 0 ? null : after;
    }
  }
  return out;
}

/**
 * Translate a form state (always-string) into the partial body the API
 * accepts. Used by the create dialog so we don't ship empty strings to
 * the server.
 */
export function formStateToLinks(state: AgencyLinksFormState): Partial<AgencyLinks> {
  const out: Partial<AgencyLinks> = {};
  for (const key of AGENCY_LINK_KEYS) {
    const v = state[key].trim();
    if (v.length > 0) out[key] = v;
  }
  return out;
}

/**
 * Normalize a links object into the always-string shape the form needs
 * (nulls become empty strings).
 */
export function linksToFormState(
  links: AgencyLinks | null | undefined,
): AgencyLinksFormState {
  return {
    onlyfans: links?.onlyfans ?? "",
    infloww: links?.infloww ?? "",
    instagram: links?.instagram ?? "",
    website: links?.website ?? "",
  };
}

/** Empty form state — convenience for the create dialog's initial render. */
export function emptyLinksForm(): AgencyLinksFormState {
  return { onlyfans: "", infloww: "", instagram: "", website: "" };
}
