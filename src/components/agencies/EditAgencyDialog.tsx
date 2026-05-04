"use client";

/**
 * "Edit agency" dialog.
 *
 * Admin-only. Lets the operator rename an agency, rotate the owner
 * username, and reset the owner password. The password field is empty by
 * default — submitting with it blank leaves the existing hash untouched.
 */

import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, RefreshCw } from "lucide-react";

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
import { useUpdateAgency } from "@/lib/agencies/agencies.hooks";
import type { Agency } from "@/lib/agencies/types";

interface Props {
  agency: Agency | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditAgencyDialog({ agency, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const update = useUpdateAgency();

  const [name, setName] = useState("");
  const [ownerUsername, setOwnerUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (agency) {
      setName(agency.name);
      setOwnerUsername(agency.ownerUsername);
      setNewPassword("");
      setShowPassword(false);
    }
  }, [agency]);

  if (!agency) return null;

  const generate = () => {
    setNewPassword(generatePassword());
    setShowPassword(true);
  };

  const submit = () => {
    const body: Parameters<typeof update.mutate>[0]["body"] = {};
    const trimmedName = name.trim();
    const trimmedUser = ownerUsername.trim().toLowerCase();
    if (trimmedName && trimmedName !== agency.name) {
      body.name = trimmedName;
    }
    if (trimmedUser && trimmedUser !== agency.ownerUsername) {
      body.ownerUsername = trimmedUser;
    }
    if (newPassword.length > 0) {
      body.ownerPassword = newPassword;
    }

    if (Object.keys(body).length === 0) {
      toast({ title: "No changes", description: "Nothing to update." });
      return;
    }

    update.mutate(
      { id: agency._id, body },
      {
        onSuccess: () => {
          if (newPassword) {
            toast({
              title: `Agency "${trimmedName || agency.name}" updated`,
              description: `New owner password: ${newPassword}`,
              duration: 20000,
            });
          } else {
            toast({ title: `Agency "${trimmedName || agency.name}" updated` });
          }
          onOpenChange(false);
        },
        onError: (e) =>
          toast({
            title: "Could not update agency",
            description: (e as Error).message,
            variant: "destructive",
          }),
      },
    );
  };

  const canSubmit =
    name.trim().length > 0 && ownerUsername.trim().length >= 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit agency</DialogTitle>
          <DialogDescription>
            Renaming and credential rotation are immediate. Existing
            agency-owner sessions stay valid until they expire — rotate the
            password if you want to invalidate access right away.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ag-edit-name">Agency name</Label>
            <Input
              id="ag-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ag-edit-owner">Owner username</Label>
            <Input
              id="ag-edit-owner"
              value={ownerUsername}
              onChange={(e) => setOwnerUsername(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ag-edit-pass">
              Reset password{" "}
              <span className="text-muted-foreground font-normal">
                (leave blank to keep)
              </span>
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="ag-edit-pass"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
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
