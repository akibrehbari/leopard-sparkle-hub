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
import { useDeleteWorker } from "@/lib/workers/workers.hooks";
import type { Worker } from "@/lib/workers/types";

interface Props {
  worker: Worker | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteWorkerDialog({ worker, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const remove = useDeleteWorker();
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    if (open) setConfirm("");
  }, [open]);

  if (!worker) return null;

  const matches =
    confirm.trim().toLowerCase() === worker.name.trim().toLowerCase();

  const submit = () => {
    remove.mutate(worker._id, {
      onSuccess: () => {
        toast({ title: `Worker "${worker.name}" deleted` });
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
            Delete worker
          </DialogTitle>
          <DialogDescription>
            This permanently removes{" "}
            <strong className="text-foreground">{worker.name}</strong> and
            revokes their login access. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="wk-delete-confirm">
              Type{" "}
              <code className="px-1 py-0.5 rounded bg-muted text-foreground font-mono text-xs">
                {worker.name}
              </code>{" "}
              to confirm
            </Label>
            <Input
              id="wk-delete-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={worker.name}
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
