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
import { useToast } from "@/hooks/use-toast";
import { useUpdateInfluencer } from "@/lib/influencers/influencers.hooks";
import type { Influencer } from "@/lib/influencers/types";
import { PasswordField } from "@/components/shared/PasswordField";
import { PLATFORM_KEYS } from "@/lib/platforms/registry";

const PLATFORM_LABELS: Record<string, string> = {
  reddit: "Reddit username",
  instagram: "Instagram username",
  x: "X username",
  onlyfans: "OnlyFans username",
};

interface Props {
  influencer: Influencer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditInfluencerDialog({ influencer, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const update = useUpdateInfluencer();

  const [name, setName] = useState("");
  const [handles, setHandles] = useState<Record<string, string>>({});
  const [inflowwCreatorId, setInflowwCreatorId] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  useEffect(() => {
    if (influencer) {
      setName(influencer.name);
      const h: Record<string, string> = {};
      for (const k of PLATFORM_KEYS) h[k] = influencer.handles?.[k] ?? "";
      setHandles(h);
      setInflowwCreatorId(influencer.inflowwCreatorId ?? "");
      setLoginUsername(influencer.loginUsername ?? "");
      setLoginPassword("");
    }
  }, [influencer]);

  if (!influencer) return null;

  const submit = () => {
    const handlesPayload: Record<string, string> = {};
    for (const k of PLATFORM_KEYS) {
      handlesPayload[k] = handles[k]?.trim() ?? "";
    }

    update.mutate(
      {
        id: influencer._id,
        body: {
          name: name.trim() || influencer.name,
          handles: handlesPayload,
          inflowwCreatorId: inflowwCreatorId.trim() || null,
          loginUsername: loginUsername.trim().toLowerCase() || undefined,
          ...(loginPassword ? { loginPassword } : {}),
        },
      },
      {
        onSuccess: () => {
          const msg = loginPassword
            ? `Updated · New password: ${loginPassword}`
            : "Profile updated.";
          toast({
            title: `Influencer "${name.trim() || influencer.name}" updated`,
            description: msg,
            duration: loginPassword ? 20000 : 4000,
          });
          onOpenChange(false);
        },
        onError: (e) =>
          toast({
            title: "Could not update influencer",
            description: (e as Error).message,
            variant: "destructive",
          }),
      },
    );
  };

  const canSubmit = name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit influencer</DialogTitle>
          <DialogDescription>
            Update profile details. Leave the password blank to keep the existing one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="inf-edit-name">Name</Label>
            <Input
              id="inf-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-3 pt-1 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">
              Platform handles
            </p>
            {PLATFORM_KEYS.map((key) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`inf-edit-handle-${key}`}>{PLATFORM_LABELS[key]}</Label>
                <Input
                  id={`inf-edit-handle-${key}`}
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
            <Label htmlFor="inf-edit-infloww">Infloww creator ID</Label>
            <Input
              id="inf-edit-infloww"
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
              <Label htmlFor="inf-edit-uname">Username</Label>
              <Input
                id="inf-edit-uname"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="Influencer's login username"
                autoComplete="off"
              />
            </div>
            <PasswordField
              id="inf-edit-pass"
              label="Password"
              value={loginPassword}
              onChange={setLoginPassword}
              optional
            />
          </div>
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
