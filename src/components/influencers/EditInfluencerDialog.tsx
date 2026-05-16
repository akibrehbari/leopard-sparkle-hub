"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Upload, X } from "lucide-react";
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
import type { Influencer, InfluencerHandles } from "@/lib/influencers/types";
import { PasswordField } from "@/components/shared/PasswordField";
import { PLATFORM_KEYS, PLATFORMS } from "@/lib/platforms/registry";
import type { PlatformKey } from "@/lib/platforms/registry";

const PLATFORM_LABELS: Record<string, string> = {
  reddit: "Reddit",
  instagram: "Instagram",
  x: "X",
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
  const [handles, setHandles] = useState<Record<string, string[]>>({});
  const [inflowwCreatorId, setInflowwCreatorId] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (influencer) {
      setName(influencer.name);
      const h: Record<string, string[]> = {};
      for (const k of PLATFORM_KEYS) {
        const v = influencer.handles?.[k as PlatformKey];
        h[k] = v && v.length > 0 ? v : [""];
      }
      setHandles(h);
      setInflowwCreatorId(influencer.inflowwCreatorId ?? "");
      setLoginUsername(influencer.loginUsername ?? "");
      setLoginPassword("");
      setAvatarFile(null);
      setAvatarPreview(null);
      setRemoveAvatar(false);
    }
  }, [influencer]);

  if (!influencer) return null;

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setRemoveAvatar(false);
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    setRemoveAvatar(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const currentAvatar = avatarPreview ?? (removeAvatar ? null : influencer.avatarUrl);

  const submit = async () => {
    const handlesPayload: InfluencerHandles = {};
    for (const k of PLATFORM_KEYS) {
      const vals = (handles[k] ?? []).map((v) => v.trim()).filter(Boolean);
      if (vals.length > 0) handlesPayload[k as PlatformKey] = vals;
    }

    let resolvedAvatarUrl: string | null | undefined = undefined;

    if (avatarFile) {
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", avatarFile);
        const res = await fetch("/api/upload/avatar", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Upload failed");
        resolvedAvatarUrl = json.url as string;
      } catch (e) {
        setUploading(false);
        toast({
          title: "Avatar upload failed",
          description: (e as Error).message,
          variant: "destructive",
        });
        return;
      }
      setUploading(false);
    } else if (removeAvatar) {
      resolvedAvatarUrl = null;
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
          ...(resolvedAvatarUrl !== undefined ? { avatarUrl: resolvedAvatarUrl } : {}),
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
          {/* Avatar picker */}
          <div className="flex flex-col items-center gap-2 pb-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative group size-20 rounded-full border-2 border-dashed border-border hover:border-primary transition-colors overflow-hidden bg-muted flex items-center justify-center"
            >
              {currentAvatar ? (
                <>
                  <img src={currentAvatar} alt="Avatar" className="size-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Upload className="size-5 text-white" />
                  </div>
                </>
              ) : (
                <Upload className="size-5 text-muted-foreground" />
              )}
            </button>
            {currentAvatar && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="size-3" /> Remove photo
              </button>
            )}
            <p className="text-xs text-muted-foreground">
              {currentAvatar ? "Click photo to change" : "Upload profile photo (optional)"}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

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
            {PLATFORM_KEYS.filter((k) => k !== "onlyfans").map((key) => (
              <div key={key} className="space-y-2">
                <Label>{PLATFORM_LABELS[key]}</Label>
                {(handles[key] ?? [""]).map((val, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={val}
                      onChange={(e) => {
                        const arr = [...(handles[key] ?? [])];
                        arr[idx] = e.target.value;
                        setHandles((prev) => ({ ...prev, [key]: arr }));
                      }}
                      placeholder={`e.g. ${key === "reddit" ? "u/" : "@"}username`}
                      autoComplete="off"
                    />
                    {(handles[key] ?? []).length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setHandles((prev) => ({
                            ...prev,
                            [key]: prev[key].filter((_, i) => i !== idx),
                          }));
                        }}
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setHandles((prev) => ({
                      ...prev,
                      [key]: [...(prev[key] ?? []), ""],
                    }))
                  }
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1"
                >
                  <Plus className="size-3" /> Add another {PLATFORMS[key].label} handle
                </button>
              </div>
            ))}
            {/* OnlyFans — single handle */}
            <div className="space-y-1.5">
              <Label>OnlyFans username</Label>
              <Input
                value={(handles.onlyfans ?? [""])[0]}
                onChange={(e) =>
                  setHandles((prev) => ({ ...prev, onlyfans: [e.target.value] }))
                }
                placeholder="@username"
                autoComplete="off"
              />
            </div>
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
          <Button onClick={submit} disabled={!canSubmit || update.isPending || uploading}>
            {(update.isPending || uploading) && <Loader2 className="size-4 animate-spin" />}
            {uploading ? "Uploading…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
