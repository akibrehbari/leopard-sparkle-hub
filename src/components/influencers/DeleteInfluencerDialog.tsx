"use client";

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
import { useDeleteInfluencer } from "@/lib/influencers/influencers.hooks";
import type { Influencer } from "@/lib/influencers/types";

interface Props {
  influencer: Influencer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteInfluencerDialog({ influencer, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const remove = useDeleteInfluencer();
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    if (open) setConfirm("");
  }, [open]);

  if (!influencer) return null;

  const matches =
    confirm.trim().toLowerCase() === influencer.name.trim().toLowerCase();

  const submit = () => {
    remove.mutate(influencer._id, {
      onSuccess: () => {
        toast({ title: `Influencer "${influencer.name}" deleted` });
        onOpenChange(false);
      },
      onError: (e) =>
        toast({
          title: "Delete failed",
          description: (e as Error).message,
          variant: "destructive",
        }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" />
            Delete influencer
          </DialogTitle>
          <DialogDescription>
            This permanently removes{" "}
            <strong className="text-foreground">{influencer.name}</strong> and
            all their weekly entries and reviews. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="inf-delete-confirm">
              Type{" "}
              <code className="px-1 py-0.5 rounded bg-muted text-foreground font-mono text-xs">
                {influencer.name}
              </code>{" "}
              to confirm
            </Label>
            <Input
              id="inf-delete-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={influencer.name}
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
            Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
