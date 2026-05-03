"use client";

/**
 * Dynamic platform form modal.
 *
 * Shows one input per field defined in PLATFORMS[platform].fields. Prefills
 * any existing entry for the (influencer, platform, weekKey) tuple. Submits
 * via the entries upsert endpoint.
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
import type { PlatformKey } from "@/lib/platforms/registry";
import { weekShortLabel } from "@/lib/utils/week";

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

  const existing = useEntries(
    { influencerId, platform, weekKeys: [weekKey] },
    { enabled: open },
  );
  const existingEntry = existing.data?.[0];

  const upsert = useUpsertEntry();
  const remove = useDeleteEntry();

  // Build a zod schema from the platform field definitions on the fly.
  const schema = useMemo(() => {
    if (!platformDef) return z.object({}).passthrough();
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const f of platformDef.fields) {
      let inner: z.ZodTypeAny = z.coerce
        .number({ message: `${f.label} must be a number` })
        .int(`${f.label} must be a whole number`)
        .min(0, `${f.label} cannot be negative`);
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

  useEffect(() => {
    if (!open || !platformDef) return;
    const defaults: FormValues = {};
    for (const f of platformDef.fields) {
      const v = existingEntry?.data?.[f.key];
      defaults[f.key] = v === undefined ? "" : String(v);
    }
    form.reset(defaults);
  }, [open, existingEntry, platformDef, form]);

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
            description: `${influencerName} · ${platformDef?.label} · ${weekKey}`,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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
              <span className="ml-1 text-foreground/70">· editing existing entry</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {platformsLoading || existing.isLoading ? (
          <div className="space-y-2 py-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : !platformDef ? (
          <p className="text-sm text-destructive">Unknown platform: {platform}</p>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 py-1">
            {platformDef.fields.map((f) => {
              const err = form.formState.errors[f.key];
              return (
                <div key={f.key} className="space-y-1.5">
                  <Label htmlFor={`f-${f.key}`}>
                    {f.label}
                    {f.required && <span className="text-destructive"> *</span>}
                  </Label>
                  <Input
                    id={`f-${f.key}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    {...form.register(f.key)}
                  />
                  {f.hint && (
                    <p className="text-[11px] text-muted-foreground">{f.hint}</p>
                  )}
                  {err && (
                    <p className="text-[11px] text-destructive">
                      {String(err.message)}
                    </p>
                  )}
                </div>
              );
            })}

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
