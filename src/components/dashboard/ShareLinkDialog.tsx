"use client";

/**
 * Multi-model share link dialog.
 *
 * Lets the operator:
 *   1. Pick which influencers should be reachable from the share link
 *      (cmdk multi-select against the roster).
 *   2. Choose which one is initially shown (defaults to the first picked).
 *   3. Preview & copy the resulting URL of the form
 *      `/share?ids=a,b,c&selected=a&range=30d`.
 *
 * No DB writes happen here — the share is fully URL-encoded.
 */

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useInfluencers } from "@/lib/influencers/influencers.hooks";
import { buildShareUrl } from "@/lib/share/url";
import type { DashboardRange } from "@/lib/utils/range";
import { RANGE_LABELS } from "@/lib/utils/range";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  range: DashboardRange;
  /** Influencer to pre-select if known (e.g. the one currently on screen). */
  initialInfluencerId: string | null;
}

export function ShareLinkDialog({
  open,
  onOpenChange,
  range,
  initialInfluencerId,
}: Props) {
  const { data: influencers, isLoading } = useInfluencers();
  const { toast } = useToast();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [shareRange, setShareRange] = useState<DashboardRange>(range);
  const [copied, setCopied] = useState(false);

  // Reset state every time the dialog opens so it reflects the current
  // dashboard view rather than whatever the operator picked last time.
  useEffect(() => {
    if (open) {
      const initial = initialInfluencerId ? [initialInfluencerId] : [];
      setSelectedIds(initial);
      setPrimaryId(initialInfluencerId);
      setShareRange(range);
      setCopied(false);
    }
  }, [open, initialInfluencerId, range]);

  // Keep the primary in sync with the selection: if it's no longer in the
  // list, fall back to the first checked one (or null if nothing is checked).
  useEffect(() => {
    if (primaryId && !selectedIds.includes(primaryId)) {
      setPrimaryId(selectedIds[0] ?? null);
    } else if (!primaryId && selectedIds.length > 0) {
      setPrimaryId(selectedIds[0]);
    }
  }, [selectedIds, primaryId]);

  const url = useMemo(() => {
    if (selectedIds.length === 0 || !primaryId) return "";
    return `${typeof window !== "undefined" ? window.location.origin : ""}${buildShareUrl({
      ids: selectedIds,
      selected: primaryId,
      range: shareRange,
    })}`;
  }, [selectedIds, primaryId, shareRange]);

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const selectAll = () => {
    setSelectedIds((influencers ?? []).map((i) => i._id));
  };

  const clearAll = () => {
    setSelectedIds([]);
    setPrimaryId(null);
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({
        title: "Share link copied",
        description: `${selectedIds.length} model${selectedIds.length === 1 ? "" : "s"} · ${RANGE_LABELS[shareRange]}`,
      });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({
        title: "Couldn't copy link",
        description: url,
        variant: "destructive",
      });
    }
  };

  const canCopy = selectedIds.length > 0 && Boolean(primaryId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="size-4" />
            Share dashboard
          </DialogTitle>
          <DialogDescription>
            Pick the models the recipient should be able to view. They'll
            land on the primary one and can switch from a dropdown.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 min-w-0">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>
                Models{" "}
                <span className="text-muted-foreground">
                  ({selectedIds.length} selected)
                </span>
              </Label>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px]"
                  onClick={selectAll}
                  disabled={isLoading}
                >
                  Select all
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px]"
                  onClick={clearAll}
                  disabled={selectedIds.length === 0}
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="rounded-md border border-border">
              <Command>
                <CommandInput placeholder="Search models..." />
                <CommandList className="max-h-[220px]">
                  <CommandEmpty>
                    {isLoading ? "Loading..." : "No models in roster."}
                  </CommandEmpty>
                  <CommandGroup>
                    {(influencers ?? []).map((inf) => {
                      const checked = selectedIds.includes(inf._id);
                      return (
                        <CommandItem
                          key={inf._id}
                          value={inf.name}
                          onSelect={() => toggle(inf._id)}
                          className="cursor-pointer"
                        >
                          <span
                            className={cn(
                              "mr-2 size-4 rounded border border-input grid place-items-center transition-colors",
                              checked && "bg-primary border-primary",
                            )}
                          >
                            {checked && (
                              <Check className="size-3 text-primary-foreground" />
                            )}
                          </span>
                          <span className="flex-1">{inf.name}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="share-primary">Land on</Label>
              <Select
                value={primaryId ?? ""}
                onValueChange={(v) => setPrimaryId(v)}
                disabled={selectedIds.length === 0}
              >
                <SelectTrigger id="share-primary" className="h-9">
                  <SelectValue placeholder="Pick one" />
                </SelectTrigger>
                <SelectContent>
                  {selectedIds.map((id) => {
                    const inf = (influencers ?? []).find((i) => i._id === id);
                    if (!inf) return null;
                    return (
                      <SelectItem key={id} value={id}>
                        {inf.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="share-range">Range</Label>
              <Select
                value={shareRange}
                onValueChange={(v) => setShareRange(v as DashboardRange)}
              >
                <SelectTrigger id="share-range" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(RANGE_LABELS) as DashboardRange[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {RANGE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5 min-w-0">
            <Label>Link preview</Label>
            <div className="flex items-center gap-2 min-w-0">
              <code className="flex-1 min-w-0 block truncate rounded-md bg-secondary/40 border border-border px-2 py-1.5 text-[11px] text-muted-foreground">
                {url || "Pick at least one model to generate a link."}
              </code>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={copy} disabled={!canCopy}>
            {copied ? (
              <>
                <Check className="size-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="size-4" />
                Copy link
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
