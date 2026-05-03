"use client";

import { useState } from "react";
import {
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Pencil,
  Save,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import {
  useCreateManualInfluencer,
  useDeleteInfluencer,
  useInfluencers,
  useSyncInfluencers,
  useUpdateInfluencer,
} from "@/lib/influencers/influencers.hooks";
import type { Influencer } from "@/lib/influencers/types";

export default function InfluencersPage() {
  const { toast } = useToast();
  const { data: influencers, isLoading, isError, error } = useInfluencers();

  const sync = useSyncInfluencers();
  const create = useCreateManualInfluencer();
  const removeMut = useDeleteInfluencer();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [redditHandle, setRedditHandle] = useState("");
  const [instaHandle, setInstaHandle] = useState("");

  const handleSync = () => {
    sync.mutate(undefined, {
      onSuccess: (r) =>
        toast({
          title: "Infloww accounts synced",
          description:
            r.created === 0 && r.updated > 0
              ? `${r.updated} existing influencer${r.updated === 1 ? "" : "s"} refreshed (no new accounts).`
              : `${r.created} added, ${r.updated} refreshed (of ${r.fetched} Infloww creator${r.fetched === 1 ? "" : "s"}).`,
        }),
      onError: (e) =>
        toast({
          title: "Sync failed",
          description: (e as Error).message,
          variant: "destructive",
        }),
    });
  };

  const handleCreate = () => {
    create.mutate(
      {
        name,
        handles: {
          reddit: redditHandle || undefined,
          instagram: instaHandle || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Influencer added" });
          setCreateOpen(false);
          setName("");
          setRedditHandle("");
          setInstaHandle("");
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
              Auto-imported Infloww accounts plus any manually added influencers.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={sync.isPending}
            >
              {sync.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Sync Infloww accounts
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Add manual
            </Button>
          </div>
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
              <p className="mt-1 text-xs">
                Click <strong className="text-foreground">Sync Infloww accounts</strong>{" "}
                to import your connected creators, or add one manually.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Reddit</TableHead>
                  <TableHead>Instagram</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {influencers.map((inf) => (
                  <InfluencerRow
                    key={inf._id}
                    influencer={inf}
                    onDelete={() => handleDelete(inf._id, inf.name)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add manual influencer</DialogTitle>
            <DialogDescription>
              For influencers without an Infloww account. You can still track
              their Reddit and Instagram progress here.
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
            <div className="space-y-1.5">
              <Label htmlFor="m-reddit">Reddit handle (optional)</Label>
              <Input
                id="m-reddit"
                value={redditHandle}
                onChange={(e) => setRedditHandle(e.target.value)}
                placeholder="username (no u/)"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-insta">Instagram handle (optional)</Label>
              <Input
                id="m-insta"
                value={instaHandle}
                onChange={(e) => setInstaHandle(e.target.value)}
                placeholder="username (no @)"
              />
            </div>
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
  onDelete,
}: {
  influencer: Influencer;
  onDelete: () => void;
}) {
  const update = useUpdateInfluencer();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [reddit, setReddit] = useState(influencer.handles.reddit ?? "");
  const [insta, setInsta] = useState(influencer.handles.instagram ?? "");

  const cancel = () => {
    setReddit(influencer.handles.reddit ?? "");
    setInsta(influencer.handles.instagram ?? "");
    setEditing(false);
  };

  const save = () => {
    update.mutate(
      {
        id: influencer._id,
        body: {
          handles: {
            reddit: reddit || undefined,
            instagram: insta || undefined,
          },
        },
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
            {influencer.inflowwUserName && (
              <div className="text-[11px] text-muted-foreground truncate">
                @{influencer.inflowwUserName}
              </div>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        {influencer.isManual ? (
          <Badge variant="outline" className="text-[10px]">
            Manual
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px]">
            Infloww
          </Badge>
        )}
      </TableCell>
      <TableCell>
        {editing ? (
          <Input
            value={reddit}
            onChange={(e) => setReddit(e.target.value)}
            placeholder="reddit handle"
            className="h-8 text-xs"
          />
        ) : (
          <span className="text-xs text-muted-foreground">
            {influencer.handles.reddit ? `u/${influencer.handles.reddit}` : "—"}
          </span>
        )}
      </TableCell>
      <TableCell>
        {editing ? (
          <Input
            value={insta}
            onChange={(e) => setInsta(e.target.value)}
            placeholder="instagram handle"
            className="h-8 text-xs"
          />
        ) : (
          <span className="text-xs text-muted-foreground">
            {influencer.handles.instagram
              ? `@${influencer.handles.instagram}`
              : "—"}
          </span>
        )}
      </TableCell>
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
    </TableRow>
  );
}
