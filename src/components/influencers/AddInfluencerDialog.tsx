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
import { useToast } from "@/hooks/use-toast";
import { useCreateInfluencer } from "@/lib/influencers/influencers.hooks";
import { PasswordField } from "@/components/shared/PasswordField";
import { PLATFORM_KEYS } from "@/lib/platforms/registry";

interface Props {
  trigger?: React.ReactNode;
}

const PLATFORM_LABELS: Record<string, string> = {
  reddit: "Reddit username",
  instagram: "Instagram username",
  x: "X username",
  onlyfans: "OnlyFans username",
};

function emptyHandles(): Record<string, string> {
  return Object.fromEntries(PLATFORM_KEYS.map((k) => [k, ""]));
}

export function AddInfluencerDialog({ trigger }: Props) {
  const { toast } = useToast();
  const create = useCreateInfluencer();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [handles, setHandles] = useState<Record<string, string>>(emptyHandles);
  const [inflowwCreatorId, setInflowwCreatorId] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const reset = () => {
    setName("");
    setHandles(emptyHandles());
    setInflowwCreatorId("");
    setLoginUsername("");
    setLoginPassword("");
  };

  const submit = () => {
    const handlesPayload: Record<string, string> = {};
    for (const k of PLATFORM_KEYS) {
      const v = handles[k]?.trim();
      if (v) handlesPayload[k] = v;
    }

    create.mutate(
      {
        name: name.trim(),
        handles: handlesPayload,
        ...(inflowwCreatorId.trim() ? { inflowwCreatorId: inflowwCreatorId.trim() } : {}),
        ...(loginUsername.trim() ? { loginUsername: loginUsername.trim().toLowerCase() } : {}),
        ...(loginPassword ? { loginPassword } : {}),
      },
      {
        onSuccess: (inf) => {
          const cred =
            loginUsername.trim() && loginPassword
              ? ` · Login: ${loginUsername.trim().toLowerCase()} / ${loginPassword}`
              : "";
          toast({
            title: `Influencer "${inf.name}" created`,
            description: `Created successfully${cred}`,
            duration: 20000,
          });
          reset();
          setOpen(false);
        },
        onError: (e) =>
          toast({
            title: "Could not create influencer",
            description: (e as Error).message,
            variant: "destructive",
          }),
      },
    );
  };

  const canSubmit =
    name.trim().length > 0 &&
    (!loginUsername.trim() || loginPassword.length >= 8);

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
            Add influencer
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add influencer</DialogTitle>
          <DialogDescription>
            Create a new influencer profile. Portal credentials are optional —
            add them now or set them later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="inf-name">Name</Label>
            <Input
              id="inf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Influencer display name"
              autoFocus
            />
          </div>

          <div className="space-y-3 pt-1 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">
              Platform handles
            </p>
            {PLATFORM_KEYS.map((key) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`inf-handle-${key}`}>{PLATFORM_LABELS[key]}</Label>
                <Input
                  id={`inf-handle-${key}`}
                  value={handles[key] ?? ""}
                  onChange={(e) =>
                    setHandles((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  placeholder={`e.g. ${key === "reddit" ? "u/" : "@"}username`}
                  autoComplete="off"
                />
              </div>
            ))}
          </div>

          <div className="space-y-1.5 pt-1 border-t border-border">
            <Label htmlFor="inf-infloww">Infloww creator ID</Label>
            <Input
              id="inf-infloww"
              value={inflowwCreatorId}
              onChange={(e) => setInflowwCreatorId(e.target.value)}
              placeholder="Optional — used to sync OF subscriber count"
              autoComplete="off"
            />
          </div>

          <div className="space-y-3 pt-1 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">
              Portal login credentials
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="inf-uname">Username</Label>
              <Input
                id="inf-uname"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="Influencer's login username"
                autoComplete="off"
              />
            </div>
            <PasswordField
              id="inf-pass"
              value={loginPassword}
              onChange={setLoginPassword}
              optional={!loginUsername.trim()}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit || create.isPending}>
            {create.isPending && <Loader2 className="size-4 animate-spin" />}
            Create influencer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
