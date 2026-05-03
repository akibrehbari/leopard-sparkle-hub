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
 */

import { useEffect, useMemo } from "react";
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
  type PlatformField,
  type PlatformKey,
} from "@/lib/platforms/registry";
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
}

export function EntryFormModal({
  open,
  onOpenChange,
  influencerId,
  influencerName,
  platform,
  weekKey,
}: Props) {
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
    return z.object(shape);
  }, [platformDef]);

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
    form.reset(defaults);
  }, [open, existingEntry, platformDef, form]);

  /* -- Submit / delete --------------------------------------------------- */

  const onSubmit = (values: FormValues) => {
    upsert.mutate(
      {
        influencerId,
        platform,
        weekKey,
        data: values as Record<string, number | string>,
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
              />
            ) : (
              platformDef.fields.map((f) => (
                <FieldRow
                  key={f.key}
                  field={f}
                  hint={priorHintFor(f)}
                  form={form}
                />
              ))
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
}: {
  fieldByKey: Map<string, PlatformField>;
  existingData: Record<string, number> | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any;
}) {
  return (
    <div className="space-y-4">
      {ACQUISITION_PLATFORM_KEYS.map((src) => {
        const revKey = onlyFansFieldKey("revenue", src);
        const spdKey = onlyFansFieldKey("spend", src);
        const revField = fieldByKey.get(revKey);
        const spdField = fieldByKey.get(spdKey);
        if (!revField || !spdField) return null;

        const revCents = existingData?.[revKey];
        const spdCents = existingData?.[spdKey];
        const subtotal =
          (typeof revCents === "number" ? centsToUsd(revCents) : 0) -
          (typeof spdCents === "number" ? centsToUsd(spdCents) : 0);

        return (
          <fieldset
            key={src}
            className="rounded-lg border border-border bg-secondary/20 p-3"
          >
            <legend className="px-1.5 -ml-1.5 inline-flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ background: SOURCE_COLORS[src] }}
              />
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                {SOURCE_LABELS[src]}
              </span>
              {existingData &&
                (typeof revCents === "number" || typeof spdCents === "number") && (
                  <span className="text-[10px] text-muted-foreground">
                    · net {formatUSD(subtotal, { fractional: true })}
                  </span>
                )}
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
              <CompactCurrencyInput
                field={revField}
                form={form}
                label="Revenue"
              />
              <CompactCurrencyInput
                field={spdField}
                form={form}
                label="Total spend"
              />
            </div>
            {(revField.hint || spdField.hint) && (
              <p className="text-[11px] text-muted-foreground mt-2">
                {spdField.hint ?? revField.hint}
              </p>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}

function CompactCurrencyInput({
  field,
  form,
  label,
}: {
  field: PlatformField;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any;
  label: string;
}) {
  const err = form.formState.errors[field.key];
  return (
    <div className="space-y-1">
      <Label htmlFor={`f-${field.key}`} className="text-[11px]">
        {label}
      </Label>
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
          $
        </span>
        <Input
          id={`f-${field.key}`}
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          placeholder="0.00"
          className="pl-7"
          {...form.register(field.key)}
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
