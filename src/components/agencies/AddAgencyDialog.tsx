"use client";

/**
 * "Add agency" dialog.
 *
 * Collects agency name + owner username + owner password. Password has a
 * "generate" affordance (random 16-char URL-safe string) and a "show /
 * hide" toggle so the admin can copy it before submitting.
 *
 * On success we surface the password back in a toast — agency owners log
 * in with these credentials, so the admin needs to send them out of band
 * (Slack DM, password manager, etc).
 */

import { useState } from "react";
import { Eye, EyeOff, Loader2, Plus, RefreshCw } from "lucide-react";

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
import { useCreateAgency } from "@/lib/agencies/agencies.hooks";

interface Props {
  trigger?: React.ReactNode;
}

export function AddAgencyDialog({ trigger }: Props) {
  const { toast } = useToast();
  const create = useCreateAgency();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [ownerUsername, setOwnerUsername] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const reset = () => {
    setName("");
    setOwnerUsername("");
    setOwnerPassword("");
    setShowPassword(false);
  };

  const generate = () => {
    setOwnerPassword(generatePassword());
    setShowPassword(true);
  };

  const submit = () => {
    create.mutate(
      {
        name: name.trim(),
        ownerUsername: ownerUsername.trim().toLowerCase(),
        ownerPassword,
      },
      {
        onSuccess: (agency) => {
          toast({
            title: `Agency "${agency.name}" created`,
            description: `Owner login: ${agency.ownerUsername} / ${ownerPassword}`,
            duration: 20000,
          });
          reset();
          setOpen(false);
        },
        onError: (e) =>
          toast({
            title: "Could not create agency",
            description: (e as Error).message,
            variant: "destructive",
          }),
      },
    );
  };

  const canSubmit =
    name.trim().length > 0 &&
    ownerUsername.trim().length >= 3 &&
    ownerPassword.length >= 8;

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
            Add agency
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add agency</DialogTitle>
          <DialogDescription>
            Each agency is an isolated tenant. Influencers, subreddits and
            weekly entries created while this agency is active are visible
            only to admin/editor sessions and to the agency owner you set
            up below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ag-name">Agency name</Label>
            <Input
              id="ag-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Talent Co"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ag-owner">Owner username</Label>
            <Input
              id="ag-owner"
              value={ownerUsername}
              onChange={(e) => setOwnerUsername(e.target.value)}
              placeholder="e.g. acme-owner"
              autoComplete="off"
            />
            <p className="text-[11px] text-muted-foreground">
              Lowercase letters, digits, '.', '_' or '-'. 3-64 characters.
              Cannot collide with the admin/editor env credential usernames.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ag-pass">Owner password</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="ag-pass"
                  type={showPassword ? "text" : "password"}
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  className="pr-9 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={generate}
                title="Generate random password"
              >
                <RefreshCw className="size-4" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Stored as a bcrypt hash. Copy the password before submitting —
              it cannot be recovered later, only reset.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit || create.isPending}>
            {create.isPending && <Loader2 className="size-4 animate-spin" />}
            Create agency
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Generate a 16-char URL-safe random password. Web Crypto where available
 * (browser); falls back to Math.random for SSR (the dialog only ever runs
 * in the browser, so the fallback is purely defensive).
 */
function generatePassword(): string {
  const alphabet =
    "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789-_";
  const length = 16;
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    let out = "";
    for (const b of bytes) out += alphabet[b % alphabet.length];
    return out;
  }
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
