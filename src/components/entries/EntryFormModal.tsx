"use client";

/**
 * Dynamic platform form modal.
 *
 * Renders one input per field defined in PLATFORMS[platform].fields and:
 *   - Prefills the existing entry for (influencer × platform × weekKey) so
 *     editing is non-destructive.
 *   - Formats currency fields with a $ prefix; submits dollars (the API
 *     coerces dollars → cents before storage).
 *   - For cumulative fields, fetches the few prior weeks and shows a
 *     "Last entry: 12,340 (May 4–10)" hint so the operator can sanity-check
 *     that their input went up not down.
 *   - For OnlyFans, groups the 6 fields into per-source sub-sections
 *     (Reddit / Instagram / X), each with revenue + spend side-by-side.
 *     The subscribers field is shown separately at the top with an Infloww sync.
 */

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { usePlatforms } from "@/lib/platforms/platforms.hooks";
import {
  useDeleteEntry,
  useEntries,
  useUpsertEntry,
} from "@/lib/entries/entries.hooks";
import {
  ACQUISITION_PLATFORM_KEYS,
  type AcquisitionPlatformKey,
  onlyFansFieldKey,
  onlyFansSlotKey,
  type HandleSlot,
  type PlatformField,
  type PlatformKey,
} from "@/lib/platforms/registry";
import type { InfluencerHandles } from "@/lib/influencers/types";
import { centsToUsd, formatNumber, formatUSD } from "@/lib/utils/format";
import { lastNWeeks, weekShortLabel } from "@/lib/utils/week";
import { priorCumulativeValue } from "@/lib/utils/derive";

const PRIOR_LOOKBACK_WEEKS = 12;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  influencerId: string;
  influencerName: string;
  platform: PlatformKey;
  weekKey: string;
  /** When true, hides revenue/spend/cost fields — used for worker portals. */
  hideFinancials?: boolean;
  /**
   * The influencer's current handles — used to derive which OnlyFans
   * acquisition slots to show (one section per handle per platform).
   */
  influencerHandles?: InfluencerHandles;
}

export function EntryFormModal({
  open,
  onOpenChange,
  influencerId,
  influencerName,
  platform,
  weekKey,
  hideFinancials,
  influencerHandles,
}: Props) {
  // Build one slot per handle per acquisition platform (ordered by platform then index).
  const activeSlots: HandleSlot[] = useMemo(() => {
    if (!influencerHandles) return [];
    const slots: HandleSlot[] = [];
    for (const src of ACQUISITION_PLATFORM_KEYS) {
      const hs = influencerHandles[src] ?? [];
      hs.forEach((handle, i) => slots.push({ source: src, index: i, handle }));
    }
    return slots;
  }, [influencerHandles]);
  const { toast } = useToast();
  const { data: platforms, isLoading: platformsLoading } = usePlatforms();
  const platformDef = platforms?.[platform];

  /**
   * Pull the last 12 weeks (including this one) so we have:
   *   - the existing entry for this exact week (prefill)
   *   - prior cumulative values for the hint line
   * Both come from a single query.
   */
  const lookbackWeeks = useMemo(() => {
    // Always include the target weekKey + the 11 weeks ending on it.
    const recent = lastNWeeks(PRIOR_LOOKBACK_WEEKS);
    const set = new Set(recent);
    set.add(weekKey);
    return Array.from(set).sort();
  }, [weekKey]);

  const lookback = useEntries(
    { influencerId, platform, weekKeys: lookbackWeeks },
    { enabled: open },
  );
  const allEntries = lookback.data ?? [];
  const existingEntry = allEntries.find((e) => e.weekKey === weekKey);

  const upsert = useUpsertEntry();
  const remove = useDeleteEntry();

  /* -- Schema generation ------------------------------------------------- */

  const schema = useMemo(() => {
    if (!platformDef) return z.object({}).passthrough();
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const f of platformDef.fields) {
      const isCurrency = (f.kind ?? "count") === "currencyCents";
      const errorPrefix = `${f.label}`;
      let inner: z.ZodTypeAny = z.coerce
        .number({ message: `${errorPrefix} must be a number` })
        .min(0, `${errorPrefix} cannot be negative`);
      if (!isCurrency) {
        inner = (inner as z.ZodNumber).int(`${errorPrefix} must be a whole number`);
      }
      if (!f.required) {
        inner = z.union([
          inner,
          z.literal("").transform(() => undefined),
          z.undefined(),
        ]);
      }
      shape[f.key] = inner;
    }
    // single note at the bottom for all non-OnlyFans platforms
    if (platform !== "onlyfans") {
      shape[`_note_global`] = z.string().optional();
    }
    // chatter note + per-slot checkboxes for OnlyFans
    if (platform === "onlyfans") {
      shape[`_chatternote_global`] = z.string().optional();
      const slots = activeSlots.length > 0
        ? activeSlots
        : ACQUISITION_PLATFORM_KEYS.map((src) => ({ source: src, index: 0, handle: "" }));
      for (const { source, index } of slots) {
        const sfx = index === 0 ? "" : `__${index}`;
        shape[`_chk_freesub_${source}${sfx}`]  = z.boolean().optional();
        shape[`_chk_paidsub_${source}${sfx}`]  = z.boolean().optional();
        shape[`_chk_freetrial_${source}${sfx}`] = z.boolean().optional();
      }
    }
    return z.object(shape);
  }, [platformDef, platform]);

  type FormValues = Record<string, number | string | undefined>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {},
  });

  /* -- Prefill (and re-prefill when switching weeks) -------------------- */

  useEffect(() => {
    if (!open || !platformDef) return;
    const defaults: FormValues = {};
    for (const f of platformDef.fields) {
      const raw = existingEntry?.data?.[f.key];
      if (raw === undefined) {
        defaults[f.key] = "";
      } else if ((f.kind ?? "count") === "currencyCents") {
        defaults[f.key] = String(centsToUsd(raw));
      } else {
        defaults[f.key] = String(raw);
      }
    }
    if (platform !== "onlyfans") {
      defaults[`_note_global`] = existingEntry?.notes?.["global"] ?? "";
    }
    if (platform === "onlyfans") {
      defaults[`_chatternote_global`] = existingEntry?.notes?.["chatter_global"] ?? "";
      const slots = activeSlots.length > 0
        ? activeSlots
        : ACQUISITION_PLATFORM_KEYS.map((src) => ({ source: src, index: 0, handle: "" }));
      for (const { source, index } of slots) {
        const sfx = index === 0 ? "" : `__${index}`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (defaults as any)[`_chk_freesub_${source}${sfx}`]  = !!(existingEntry?.data?.[`freesub_${source}${sfx}`]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (defaults as any)[`_chk_paidsub_${source}${sfx}`]  = !!(existingEntry?.data?.[`paidsub_${source}${sfx}`]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (defaults as any)[`_chk_freetrial_${source}${sfx}`] = !!(existingEntry?.data?.[`freetrial_${source}${sfx}`]);
      }
    }
    form.reset(defaults);
  }, [open, existingEntry, platformDef, form]);

  /* -- Submit / delete --------------------------------------------------- */

  const onSubmit = (values: FormValues) => {
    // Separate numeric data from _note_ fields
    const data: Record<string, number | string> = {};
    const notes: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) {
      if (k.startsWith("_chatternote_")) {
        const src = k.slice(13);
        if (typeof v === "string" && v.trim()) notes[`chatter_${src}`] = v.trim();
      } else if (k === "_note_global") {
        if (typeof v === "string" && v.trim()) notes["global"] = v.trim();
      } else if (k.startsWith("_chk_")) {
        // checkbox flags: store as 1/0 in data
        const dataKey = k.slice(5);
        data[dataKey] = v ? 1 : 0;
      } else {
        data[k] = v as number | string;
      }
    }
    upsert.mutate(
      {
        influencerId,
        platform,
        weekKey,
        data,
        notes,
      },
      {
        onSuccess: () => {
          toast({
            title: existingEntry ? "Entry updated" : "Entry saved",
            description: `${influencerName} \u00b7 ${platformDef?.label} \u00b7 ${weekKey}`,
          });
          onOpenChange(false);
        },
        onError: (e) =>
          toast({
            title: "Save failed",
            description: (e as Error).message,
            variant: "destructive",
          }),
      },
    );
  };

  const handleDelete = () => {
    if (!existingEntry) return;
    if (!confirm(`Delete ${platformDef?.label} entry for ${weekKey}?`)) return;
    remove.mutate(
      { influencerId, platform, weekKey },
      {
        onSuccess: () => {
          toast({ title: "Entry deleted" });
          onOpenChange(false);
        },
        onError: (e) =>
          toast({
            title: "Delete failed",
            description: (e as Error).message,
            variant: "destructive",
          }),
      },
    );
  };

  /* -- Derived UI helpers ------------------------------------------------ */

  /**
   * For a given field, find the most recent prior cumulative value (if any)
   * to display as a sanity hint under the input.
   */
  const priorHintFor = (field: PlatformField): string | null => {
    if (!field.cumulative) return null;
    const prior = priorCumulativeValue(allEntries, weekKey, field.key);
    if (!prior) return null;
    return `Last entry: ${formatNumber(prior.value)} \u00b7 ${weekShortLabel(prior.weekKey)}`;
  };

  /* -- Layout ------------------------------------------------------------ */

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-full"
              style={{ background: platformDef?.color ?? "#888" }}
            />
            {platformDef?.label ?? platform} · {influencerName}
          </DialogTitle>
          <DialogDescription>
            {weekShortLabel(weekKey)}
            {existingEntry && (
              <span className="ml-1 text-foreground/70">
                · editing existing entry
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {platformsLoading || lookback.isLoading ? (
          <div className="space-y-2 py-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : !platformDef ? (
          <p className="text-sm text-destructive">Unknown platform: {platform}</p>
        ) : (
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 py-1 max-h-[65vh] overflow-y-auto pr-1"
          >
            {platform === "onlyfans" ? (
              <OnlyFansFields
                fieldByKey={new Map(platformDef.fields.map((f) => [f.key, f]))}
                existingData={existingEntry?.data}
                form={form}
                hideFinancials={hideFinancials}
                activeSlots={activeSlots}
              />
            ) : (
              <>
                {platformDef.fields.map((f) => (
                  <FieldRow
                    key={f.key}
                    field={f}
                    hint={priorHintFor(f)}
                    form={form}
                  />
                ))}
                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="note-global" className="text-xs text-muted-foreground">
                    Note <span className="font-normal">(optional)</span>
                  </Label>
                  <textarea
                    id="note-global"
                    placeholder="Add a note…"
                    rows={2}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                    {...form.register("_note_global")}
                  />
                </div>
              </>
            )}

            <DialogFooter className="pt-2">
              <div className="mr-auto">
                {existingEntry && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    disabled={remove.isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    {remove.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                    Delete
                  </Button>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={upsert.isPending}>
                {upsert.isPending && <Loader2 className="size-4 animate-spin" />}
                {existingEntry ? "Save changes" : "Save entry"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*  Generic field row                                                         */
/* -------------------------------------------------------------------------- */

function FieldRow({
  field,
  hint,
  form,
}: {
  field: PlatformField;
  hint: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any;
}) {
  const isCurrency = (field.kind ?? "count") === "currencyCents";
  const err = form.formState.errors[field.key];
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`f-${field.key}`}>
        {field.label}
        {field.required && <span className="text-destructive"> *</span>}
      </Label>
      <div className="relative">
        {isCurrency && (
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
            $
          </span>
        )}
        <Input
          id={`f-${field.key}`}
          type="number"
          inputMode={isCurrency ? "decimal" : "numeric"}
          min={0}
          step={isCurrency ? "0.01" : 1}
          className={isCurrency ? "pl-7" : undefined}
          placeholder={isCurrency ? "0.00" : undefined}
          {...form.register(field.key)}
        />
      </div>
      {field.hint && (
        <p className="text-[11px] text-muted-foreground">{field.hint}</p>
      )}
      {hint && (
        <p className="text-[11px] text-info">{hint}</p>
      )}
      {err && (
        <p className="text-[11px] text-destructive">
          {String(err.message)}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  OnlyFans grouped layout                                                   */
/* -------------------------------------------------------------------------- */

const SOURCE_COLORS: Record<AcquisitionPlatformKey, string> = {
  reddit: "#FF4500",
  instagram: "#E4405F",
  x: "#FFFFFF",
};

const SOURCE_LABELS: Record<AcquisitionPlatformKey, string> = {
  reddit: "Reddit",
  instagram: "Instagram",
  x: "X",
};

function OnlyFansFields({
  fieldByKey,
  existingData,
  form,
  hideFinancials,
  activeSlots,
}: {
  fieldByKey: Map<string, PlatformField>;
  existingData: Record<string, number> | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any;
  hideFinancials?: boolean;
  activeSlots: HandleSlot[];
}) {
  const subscribersField = fieldByKey.get("subscribers");

  const visibleSlots = activeSlots.length > 0
    ? activeSlots
    : ACQUISITION_PLATFORM_KEYS.map((src) => ({ source: src, index: 0, handle: "" }));

  // Auto-sum subscribers from all visible slots
  const subsKeys = visibleSlots.map(({ source, index }) => onlyFansSlotKey("subs", source, index));
  const watchedSubs = form.watch(subsKeys);
  const totalSubs = subsKeys.reduce((sum: number, _: string, i: number) => {
    const v = Number(watchedSubs[i]);
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  useEffect(() => {
    form.setValue("subscribers", String(totalSubs), { shouldDirty: true });
  }, [totalSubs, form]);

  return (
    <div className="space-y-4">
      {visibleSlots.map(({ source: src, index, handle }) => {
        const sfx = index === 0 ? "" : `__${index}`;
        const subsKey = onlyFansSlotKey("subs", src, index);
        // revenue/spend use the base field definition (same field shape for each slot)
        const baseRevKey = onlyFansFieldKey("revenue", src);
        const baseSpdKey = onlyFansFieldKey("spend", src);
        const revKey = index === 0 ? baseRevKey : `revenue_${src}${sfx}`;
        const spdKey = index === 0 ? baseSpdKey : `spend_${src}${sfx}`;
        const revField = fieldByKey.get(baseRevKey);
        const spdField = fieldByKey.get(baseSpdKey);

        const revCents = existingData?.[revKey];
        const spdCents = existingData?.[spdKey];
        const subtotal =
          (typeof revCents === "number" ? centsToUsd(revCents) : 0) -
          (typeof spdCents === "number" ? centsToUsd(spdCents) : 0);

        const slotLabel = handle
          ? `${SOURCE_LABELS[src]} · ${src === "reddit" ? `u/${handle}` : `@${handle}`}`
          : SOURCE_LABELS[src];

        return (
          <fieldset
            key={`${src}-${index}`}
            className="rounded-lg border border-border bg-secondary/20 p-3"
          >
            <legend className="px-1.5 -ml-1.5 inline-flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ background: SOURCE_COLORS[src] }}
              />
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                {slotLabel}
              </span>
              {!hideFinancials && existingData &&
                (typeof revCents === "number" || typeof spdCents === "number") && (
                  <span className="text-[10px] text-muted-foreground">
                    · net {formatUSD(subtotal, { fractional: true })}
                  </span>
                )}
            </legend>
            <div className="space-y-3 mt-1">
              <div className="space-y-1">
                <Label htmlFor={`f-${subsKey}`} className="text-[11px]">
                  Subscribers this week
                </Label>
                <Input
                  id={`f-${subsKey}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  placeholder="0"
                  {...form.register(subsKey)}
                />
                {form.formState.errors[subsKey] && (
                  <p className="text-[10px] text-destructive">
                    {String(form.formState.errors[subsKey]?.message)}
                  </p>
                )}
              </div>

              {/* Subscription type checkboxes */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-muted-foreground block">Subscription type</span>
                <div className="flex flex-wrap gap-4">
                  {[
                    { key: `_chk_freesub_${src}${sfx}`,  label: "Free" },
                    { key: `_chk_paidsub_${src}${sfx}`,  label: "Paid" },
                    { key: `_chk_freetrial_${src}${sfx}`, label: "FTL" },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="size-3.5 rounded border-border accent-primary cursor-pointer"
                        {...form.register(key)}
                      />
                      <span className="text-[12px] text-foreground">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {!hideFinancials && revField && spdField && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <CompactCurrencyInput fieldKey={revKey} form={form} label="Revenue" />
                  <CompactCurrencyInput fieldKey={spdKey} form={form} label="Total spend" />
                </div>
              )}
            </div>
          </fieldset>
        );
      })}

      {/* Subscribers — placed after platform sections */}
      {subscribersField && (
        <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase tracking-wider">
              Total subscribers
            </Label>
            <span className="text-[11px] text-muted-foreground">Auto-calculated</span>
          </div>
          <div className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium tabular-nums">
            {totalSubs}
          </div>
        </div>
      )}

      {/* Single chatter note for the whole entry */}
      <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-2">
        <Label htmlFor="chatter-note-global" className="text-xs font-semibold uppercase tracking-wider">
          Note from chatter
        </Label>
        <textarea
          id="chatter-note-global"
          placeholder="Add chatter notes… (optional)"
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          {...form.register("_chatternote_global")}
        />
      </div>
    </div>
  );
}

function CompactCurrencyInput({
  fieldKey,
  form,
  label,
}: {
  fieldKey: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any;
  label: string;
}) {
  const err = form.formState.errors[fieldKey];
  return (
    <div className="space-y-1">
      <Label htmlFor={`f-${fieldKey}`} className="text-[11px]">
        {label}
      </Label>
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
          $
        </span>
        <Input
          id={`f-${fieldKey}`}
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          placeholder="0.00"
          className="pl-7"
          {...form.register(fieldKey)}
        />
      </div>
      {err && (
        <p className="text-[10px] text-destructive">
          {String(err.message)}
        </p>
      )}
    </div>
  );
}
