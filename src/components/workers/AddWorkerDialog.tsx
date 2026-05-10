"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useCreateWorker } from "@/lib/workers/workers.hooks";
import { useInfluencers } from "@/lib/influencers/influencers.hooks";
import { PasswordField } from "@/components/shared/PasswordField";

interface Props {
  trigger?: React.ReactNode;
}

export function AddWorkerDialog({ trigger }: Props) {
  const { toast } = useToast();
  const create = useCreateWorker();
  const { data: influencers = [] } = useInfluencers();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());

  const reset = () => {
    setName("");
    setLoginUsername("");
    setLoginPassword("");
    setAssignedIds(new Set());
  };

  const toggleInfluencer = (id: string) =>
    setAssignedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = () => {
    create.mutate(
      {
        name: name.trim(),
        loginUsername: loginUsername.trim().toLowerCase(),
        loginPassword,
        assignedInfluencerIds: Array.from(assignedIds),
      },
      {
        onSuccess: (worker) => {
          toast({
            title: `Worker "${worker.name}" created`,
            description: `Login: ${worker.loginUsername} / ${loginPassword}`,
            duration: 20000,
          });
          reset();
          setOpen(false);
        },
        onError: (e) =>
          toast({
            title: "Could not create worker",
            description: (e as Error).message,
            variant: "destructive",
          }),
      },
    );
  };

  const canSubmit =
    name.trim().length > 0 &&
    loginUsername.trim().length >= 3 &&
    loginPassword.length >= 8;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="size-4" />
            Add worker
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add worker</DialogTitle>
          <DialogDescription>
            Workers can enter weekly data for their assigned influencers.
            They see no financial information.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="wk-name">Name</Label>
            <Input
              id="wk-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Worker display name"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wk-uname">Username</Label>
            <Input
              id="wk-uname"
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              placeholder="e.g. worker-alice"
              autoComplete="off"
            />
            <p className="text-[11px] text-muted-foreground">
              Lowercase letters, digits, '.', '_' or '-'. 3–64 characters.
            </p>
          </div>

          <PasswordField
            id="wk-pass"
            value={loginPassword}
            onChange={setLoginPassword}
          />

          {influencers.length > 0 && (
            <div className="space-y-2 pt-1 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">
                Assign influencers
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
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit || create.isPending}>
            {create.isPending && <Loader2 className="size-4 animate-spin" />}
            Create worker
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
