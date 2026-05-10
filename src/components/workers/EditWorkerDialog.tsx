"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useUpdateWorker } from "@/lib/workers/workers.hooks";
import type { Worker } from "@/lib/workers/types";
import { useInfluencers } from "@/lib/influencers/influencers.hooks";
import { PasswordField } from "@/components/shared/PasswordField";

interface Props {
  worker: Worker | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditWorkerDialog({ worker, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const update = useUpdateWorker();
  const { data: influencers = [] } = useInfluencers();

  const [name, setName] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (worker) {
      setName(worker.name);
      setLoginUsername(worker.loginUsername);
      setLoginPassword("");
      setAssignedIds(new Set(worker.assignedInfluencerIds));
    }
  }, [worker]);

  if (!worker) return null;

  const toggleInfluencer = (id: string) =>
    setAssignedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = () => {
    update.mutate(
      {
        id: worker._id,
        body: {
          name: name.trim() || worker.name,
          loginUsername: loginUsername.trim().toLowerCase() || worker.loginUsername,
          ...(loginPassword ? { loginPassword } : {}),
          assignedInfluencerIds: Array.from(assignedIds),
        },
      },
      {
        onSuccess: () => {
          const msg = loginPassword
            ? `Updated · New password: ${loginPassword}`
            : "Worker updated.";
          toast({
            title: `Worker "${name.trim() || worker.name}" updated`,
            description: msg,
            duration: loginPassword ? 20000 : 4000,
          });
          onOpenChange(false);
        },
        onError: (e) =>
          toast({
            title: "Could not update worker",
            description: (e as Error).message,
            variant: "destructive",
          }),
      },
    );
  };

  const canSubmit = name.trim().length > 0 && loginUsername.trim().length >= 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit worker</DialogTitle>
          <DialogDescription>
            Update worker details and assignments. Leave the password blank to keep the existing one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="wk-edit-name">Name</Label>
            <Input
              id="wk-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wk-edit-uname">Username</Label>
            <Input
              id="wk-edit-uname"
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              autoComplete="off"
            />
          </div>

          <PasswordField
            id="wk-edit-pass"
            label="Password"
            value={loginPassword}
            onChange={setLoginPassword}
            optional
          />

          {influencers.length > 0 && (
            <div className="space-y-2 pt-1 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">
                Assigned influencers
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {influencers.map((inf) => (
                  <label
                    key={inf._id}
                    className="flex items-center gap-2.5 cursor-pointer py-1"
                  >
                    <Checkbox
                      checked={assignedIds.has(inf._id)}
                      onCheckedChange={() => toggleInfluencer(inf._id)}
                    />
                    <span className="text-sm">{inf.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit || update.isPending}>
            {update.isPending && <Loader2 className="size-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
