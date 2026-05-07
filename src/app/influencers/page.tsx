"use client";

/**
 * Influencer roster page (path: /influencers).
 *
 * Pure CRUD now that the Infloww sync is gone. The table renders one row per
 * influencer with their handles for each tracked platform; click a row to
 * edit. The Add dialog collects a name plus optional handles.
 *
 * Field set is driven by the platform registry — adding a new platform
 * key automatically adds a new column + edit input here.
 */

import { useState } from "react";
import { KeyRound, Loader2, Plus, Trash2, Pencil, Save, X } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/lib/auth/auth.hooks";
import { isAdmin } from "@/lib/auth/roles";
import {
  useCreateInfluencer,
  useDeleteInfluencer,
  useInfluencers,
  useUpdateInfluencer,
} from "@/lib/influencers/influencers.hooks";
import api from "@/lib/api";
import type { Influencer, InfluencerHandles } from "@/lib/influencers/types";
import {
  PLATFORMS,
  PLATFORM_KEYS,
  type PlatformKey,
} from "@/lib/platforms/registry";

const HANDLE_PREFIX: Record<PlatformKey, string> = {
  reddit: "u/",
  instagram: "@",
  x: "@",
  onlyfans: "@",
};

const HANDLE_PLACEHOLDER: Record<PlatformKey, string> = {
  reddit: "username (no u/)",
  instagram: "username (no @)",
  x: "username (no @)",
  onlyfans: "username (no @)",
};

function emptyHandles(): Record<PlatformKey, string> {
  return PLATFORM_KEYS.reduce(
    (acc, k) => {
      acc[k] = "";
      return acc;
    },
    {} as Record<PlatformKey, string>,
  );
}

function toHandlesPayload(
  draft: Record<PlatformKey, string>,
): InfluencerHandles {
  const out: InfluencerHandles = {};
  for (const k of PLATFORM_KEYS) {
    const v = draft[k]?.trim();
    if (v) out[k] = v;
  }
  return out;
}

export default function InfluencersPage() {
  const { toast } = useToast();
  const { data: influencers, isLoading, isError, error } = useInfluencers();
  const { data: session } = useSession();
  const canEdit = isAdmin(session?.role);

  const create = useCreateInfluencer();
  const removeMut = useDeleteInfluencer();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [handles, setHandles] = useState<Record<PlatformKey, string>>(emptyHandles());

  const handleCreate = () => {
    create.mutate(
      { name, handles: toHandlesPayload(handles) },
      {
        onSuccess: () => {
          toast({ title: "Influencer added" });
          setCreateOpen(false);
          setName("");
          setHandles(emptyHandles());
        },
        onError: (e) =>
          toast({
            title: "Could not add",
            description: (e as Error).message,
            variant: "destructive",
          }),
      },
    );
  };

  const handleDelete = (id: string, displayName: string) => {
    if (!confirm(`Delete "${displayName}"? Their weekly entries will remain in the database.`)) {
      return;
    }
    removeMut.mutate(id, {
      onSuccess: () => toast({ title: "Influencer deleted" }),
      onError: (e) =>
        toast({
          title: "Delete failed",
          description: (e as Error).message,
          variant: "destructive",
        }),
    });
  };

  return (
    <AppShell>
      <div className="px-6 py-6 max-w-6xl">
        <header className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-semibold">Influencers</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your roster — one row per influencer, with handles for each
              tracked platform.
            </p>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                Add influencer
              </Button>
            </div>
          )}
        </header>

        <div className="card-surface rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-md" />
              ))}
            </div>
          ) : isError ? (
            <div className="p-6 text-sm text-destructive">
              Failed to load influencers: {(error as Error).message}
            </div>
          ) : !influencers || influencers.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <p>No influencers yet.</p>
              {canEdit ? (
                <p className="mt-1 text-xs">
                  Click <strong className="text-foreground">Add influencer</strong>{" "}
                  above to create your first one.
                </p>
              ) : (
                <p className="mt-1 text-xs">
                  Ask an admin to add the first influencer.
                </p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  {PLATFORM_KEYS.map((k) => (
                    <TableHead key={k}>{PLATFORMS[k].label}</TableHead>
                  ))}
                  <TableHead>Portal login</TableHead>
                  {canEdit && <TableHead className="w-36" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {influencers.map((inf) => (
                  <InfluencerRow
                    key={inf._id}
                    influencer={inf}
                    canEdit={canEdit}
                    onDelete={() => handleDelete(inf._id, inf.name)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add influencer</DialogTitle>
            <DialogDescription>
              Name is required. Handles are optional — add them now or later
              by editing the row.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="m-name">Name</Label>
              <Input
                id="m-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jane Doe"
                autoFocus
              />
            </div>
            {PLATFORM_KEYS.map((k) => (
              <div key={k} className="space-y-1.5">
                <Label htmlFor={`m-${k}`}>
                  {PLATFORMS[k].label} handle{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id={`m-${k}`}
                  value={handles[k]}
                  onChange={(e) =>
                    setHandles((prev) => ({ ...prev, [k]: e.target.value }))
                  }
                  placeholder={HANDLE_PLACEHOLDER[k]}
                />
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || create.isPending}
            >
              {create.isPending && <Loader2 className="size-4 animate-spin" />}
              Add influencer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

/* -------------------------------------------------------------------------- */

function InfluencerRow({
  influencer,
  canEdit,
  onDelete,
}: {
  influencer: Influencer;
  canEdit: boolean;
  onDelete: () => void;
}) {
  const update = useUpdateInfluencer();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState(influencer.loginUsername ?? "");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginSaving, setLoginSaving] = useState(false);
  const [draft, setDraft] = useState<Record<PlatformKey, string>>(() =>
    PLATFORM_KEYS.reduce(
      (acc, k) => {
        acc[k] = influencer.handles[k] ?? "";
        return acc;
      },
      {} as Record<PlatformKey, string>,
    ),
  );

  const cancel = () => {
    setDraft(
      PLATFORM_KEYS.reduce(
        (acc, k) => {
          acc[k] = influencer.handles[k] ?? "";
          return acc;
        },
        {} as Record<PlatformKey, string>,
      ),
    );
    setEditing(false);
  };

  const saveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword) return;
    setLoginSaving(true);
    try {
      await api.post(`/api/influencers/${influencer._id}/credentials`, {
        loginUsername: loginUsername.trim(),
        loginPassword,
      });
      toast({ title: "Login credentials saved" });
      setLoginOpen(false);
      setLoginPassword("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save credentials";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoginSaving(false);
    }
  };

  const save = () => {
    update.mutate(
      {
        id: influencer._id,
        body: { handles: toHandlesPayload(draft) },
      },
      {
        onSuccess: () => {
          toast({ title: "Handles updated" });
          setEditing(false);
        },
        onError: (e) =>
          toast({
            title: "Update failed",
            description: (e as Error).message,
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-full bg-gradient-primary grid place-items-center shrink-0">
            <span className="text-primary-foreground text-[11px] font-semibold">
              {(influencer.name[0] ?? "?").toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate">{influencer.name}</div>
          </div>
        </div>
      </TableCell>
      {PLATFORM_KEYS.map((k) => (
        <TableCell key={k}>
          {editing && canEdit ? (
            <Input
              value={draft[k]}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, [k]: e.target.value }))
              }
              placeholder={HANDLE_PLACEHOLDER[k]}
              className="h-8 text-xs"
            />
          ) : (
            <span className="text-xs text-muted-foreground">
              {influencer.handles[k]
                ? `${HANDLE_PREFIX[k]}${influencer.handles[k]}`
                : "—"}
            </span>
          )}
        </TableCell>
      ))}
      <TableCell>
        <span className="text-xs text-muted-foreground">
          {influencer.loginUsername ?? "—"}
        </span>
      </TableCell>
      {canEdit && (
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          {editing ? (
            <>
              <Button
                size="icon"
                variant="ghost"
                onClick={save}
                disabled={update.isPending}
              >
                {update.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
              </Button>
              <Button size="icon" variant="ghost" onClick={cancel}>
                <X className="size-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                size="icon"
                variant="ghost"
                title="Set portal login"
                onClick={() => setLoginOpen(true)}
              >
                <KeyRound className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setEditing(true)}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={onDelete}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
        </div>
      </TableCell>
      )}

      {/* Set login credentials dialog */}
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Set portal login — {influencer.name}</DialogTitle>
            <DialogDescription>
              The influencer will use these credentials to log in at{" "}
              <strong>/login</strong> and view their personal portal.
              {influencer.loginUsername && (
                <span className="block mt-1 text-xs">
                  Current username: <strong>{influencer.loginUsername}</strong>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveCredentials} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor={`lu-${influencer._id}`}>Username</Label>
              <Input
                id={`lu-${influencer._id}`}
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="e.g. livy_portal"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`lp-${influencer._id}`}>
                New password{influencer.loginUsername ? " (leave blank to keep current)" : ""}
              </Label>
              <Input
                id={`lp-${influencer._id}`}
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                required={!influencer.loginUsername}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setLoginOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loginSaving || !loginUsername.trim()}>
                {loginSaving && <Loader2 className="size-4 animate-spin" />}
                Save credentials
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </TableRow>
  );
}
