"use client";

import { useRef, useState } from "react";
import { Loader2, Plus, Upload, X } from "lucide-react";
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
import { PLATFORM_KEYS, PLATFORMS, type PlatformKey } from "@/lib/platforms/registry";
import type { InfluencerHandles } from "@/lib/influencers/types";

interface Props {
  trigger?: React.ReactNode;
}

const PLATFORM_LABELS: Record<string, string> = {
  reddit: "Reddit",
  instagram: "Instagram",
  x: "X",
  onlyfans: "OnlyFans username",
};

function emptyHandles(): Record<string, string[]> {
  return Object.fromEntries(PLATFORM_KEYS.map((k) => [k, [""]]));
}

export function AddInfluencerDialog({ trigger }: Props) {
  const { toast } = useToast();
  const create = useCreateInfluencer();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [handles, setHandles] = useState<Record<string, string[]>>(emptyHandles);
  const [inflowwCreatorId, setInflowwCreatorId] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setName("");
    setHandles(emptyHandles());
    setInflowwCreatorId("");
    setLoginUsername("");
    setLoginPassword("");
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const submit = async () => {
    const handlesPayload: InfluencerHandles = {};
    for (const k of PLATFORM_KEYS) {
      const vals = (handles[k] ?? []).map((v) => v.trim()).filter(Boolean);
      if (vals.length > 0) handlesPayload[k as PlatformKey] = vals;
    }

    let avatarUrl: string | undefined;
    if (avatarFile) {
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", avatarFile);
        const res = await fetch("/api/upload/avatar", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Upload failed");
        avatarUrl = json.url as string;
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
    }

    create.mutate(
      {
        name: name.trim(),
        handles: handlesPayload,
        ...(inflowwCreatorId.trim() ? { inflowwCreatorId: inflowwCreatorId.trim() } : {}),
        ...(loginUsername.trim() ? { loginUsername: loginUsername.trim().toLowerCase() } : {}),
        ...(loginPassword ? { loginPassword } : {}),
        ...(avatarUrl ? { avatarUrl } : {}),
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
          {/* Avatar picker */}
          <div className="flex flex-col items-center gap-2 pb-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative group size-20 rounded-full border-2 border-dashed border-border hover:border-primary transition-colors overflow-hidden bg-muted flex items-center justify-center"
            >
              {avatarPreview ? (
                <>
                  <img src={avatarPreview} alt="Avatar preview" className="size-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Upload className="size-5 text-white" />
                  </div>
                </>
              ) : (
                <Upload className="size-5 text-muted-foreground" />
              )}
            </button>
            {avatarPreview && (
              <button
                type="button"
                onClick={() => { setAvatarFile(null); setAvatarPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="size-3" /> Remove photo
              </button>
            )}
            <p className="text-xs text-muted-foreground">
              {avatarPreview ? "Click photo to change" : "Upload profile photo (optional)"}
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
          <Button onClick={submit} disabled={!canSubmit || create.isPending || uploading}>
            {(create.isPending || uploading) && <Loader2 className="size-4 animate-spin" />}
            {uploading ? "Uploading…" : "Create influencer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
