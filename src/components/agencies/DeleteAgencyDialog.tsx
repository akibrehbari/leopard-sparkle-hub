"use client";

/**
 * "Delete agency" hard-confirm dialog.
 *
 * Cascade delete is irreversible — the agency itself plus every
 * influencer / weekly entry / subreddit / snapshot it owns gets dropped.
 * To prevent muscle-memory destruction we make the admin type the agency
 * name verbatim before the Delete button enables. Casing-insensitive
 * compare so "Acme" matches "acme".
 */

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useDeleteAgency } from "@/lib/agencies/agencies.hooks";
import type { Agency } from "@/lib/agencies/types";

interface Props {
  agency: Agency | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the cascade succeeds — host page can clear active-agency state. */
  onDeleted?: (agencyId: string) => void;
}

export function DeleteAgencyDialog({
  agency,
  open,
  onOpenChange,
  onDeleted,
}: Props) {
  const { toast } = useToast();
  const remove = useDeleteAgency();

  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    if (open) setConfirm("");
  }, [open]);

  if (!agency) return null;

  const expected = agency.name.trim().toLowerCase();
  const provided = confirm.trim().toLowerCase();
  const matches = expected.length > 0 && expected === provided;

  const submit = () => {
    remove.mutate(
      { id: agency._id, confirmName: confirm.trim() },
      {
        onSuccess: (res) => {
          // res shape: { ok, cascaded: { weeklyEntries, ... } } — toast it.
          const counts =
            (res as unknown as { cascaded?: Record<string, number> }).cascaded ?? {};
          const summary = Object.entries(counts)
            .map(([k, v]) => `${v} ${k.replace(/([A-Z])/g, " $1").toLowerCase()}`)
            .join(", ");
          toast({
            title: `Agency "${agency.name}" deleted`,
            description: summary
              ? `Cascaded: ${summary}.`
              : "All related records were removed.",
          });
          onDeleted?.(agency._id);
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

  const counts = agency.counts ?? {
    influencers: 0,
    subreddits: 0,
    weeklyEntries: 0,
  };
  const totalChildren =
    counts.influencers + counts.subreddits + counts.weeklyEntries;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" />
            Delete agency
          </DialogTitle>
          <DialogDescription>
            This permanently removes{" "}
            <strong className="text-foreground">{agency.name}</strong> and
            cascades to every record under it. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs space-y-1.5">
            <div className="font-medium text-destructive flex items-center gap-1.5">
              <AlertTriangle className="size-3.5" />
              Will be deleted
            </div>
            <ul className="text-muted-foreground space-y-0.5 ml-5 list-disc">
              <li>
                <strong className="text-foreground">{counts.influencers}</strong>{" "}
                influencer{counts.influencers === 1 ? "" : "s"}
              </li>
              <li>
                <strong className="text-foreground">{counts.subreddits}</strong>{" "}
                subreddit{counts.subreddits === 1 ? "" : "s"} (and their
                snapshots)
              </li>
              <li>
                <strong className="text-foreground">
                  {counts.weeklyEntries}
                </strong>{" "}
                weekly entr{counts.weeklyEntries === 1 ? "y" : "ies"}
              </li>
              <li>The agency itself + the owner credential</li>
            </ul>
            {totalChildren === 0 && (
              <p className="text-muted-foreground italic mt-1">
                This agency has no data attached — but the owner credential
                will still be revoked.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ag-delete-confirm">
              Type{" "}
              <code className="px-1 py-0.5 rounded bg-muted text-foreground font-mono text-xs">
                {agency.name}
              </code>{" "}
              to confirm
            </Label>
            <Input
              id="ag-delete-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={agency.name}
              autoComplete="off"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={!matches || remove.isPending}
          >
            {remove.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Delete agency permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
