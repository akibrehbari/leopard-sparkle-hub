"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2, UserCog } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PasswordField } from "@/components/shared/PasswordField";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";
import type { Agency } from "@/lib/agencies/types";
import type { Worker } from "@/lib/workers/types";

interface Props {
  agency: Agency | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

function useAgencyWorkers(agencyId: string | null) {
  return useQuery<Worker[]>({
    queryKey: ["agency-workers", agencyId],
    enabled: !!agencyId,
    queryFn: async () => {
      const res = await api.get(`/api/agencies/${agencyId}/workers`);
      return (res.data as { data: Worker[] }).data;
    },
  });
}

function useCreateAgencyWorker(agencyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; loginUsername: string; loginPassword: string }) => {
      const res = await api.post(`/api/agencies/${agencyId}/workers`, body);
      return (res.data as { data: Worker }).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agency-workers", agencyId] }),
  });
}

function useDeleteAgencyWorker(agencyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (workerId: string) => {
      await api.delete(`/api/agencies/${agencyId}/workers?workerId=${workerId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agency-workers", agencyId] }),
  });
}

export function AgencyWorkersDialog({ agency, open, onOpenChange }: Props) {
  if (!agency) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="size-4 text-primary" />
            Workers — {agency.name}
          </DialogTitle>
          <DialogDescription>
            Create and manage data-entry workers for this agency.
          </DialogDescription>
        </DialogHeader>
        <WorkersBody agencyId={agency._id} />
      </DialogContent>
    </Dialog>
  );
}

function WorkersBody({ agencyId }: { agencyId: string }) {
  const { toast } = useToast();
  const workersQ = useAgencyWorkers(agencyId);
  const workers = workersQ.data ?? [];
  const deleteWorker = useDeleteAgencyWorker(agencyId);

  const [showForm, setShowForm] = useState(false);

  const handleDelete = (w: Worker) => {
    if (!confirm(`Delete worker "${w.name}"? This cannot be undone.`)) return;
    deleteWorker.mutate(w._id, {
      onSuccess: () => toast({ title: `Worker "${w.name}" deleted` }),
      onError: (e) =>
        toast({ title: "Delete failed", description: (e as Error).message, variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-4 py-1">
      {/* Worker list */}
      {workersQ.isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : workers.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No workers yet for this agency.
        </p>
      ) : (
        <ul className="space-y-2">
          {workers.map((w) => (
            <li
              key={w._id}
              className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-border bg-card"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-7 rounded-full bg-gradient-primary grid place-items-center shrink-0">
                  <span className="text-primary-foreground text-[11px] font-semibold">
                    {(w.name[0] ?? "?").toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{w.name}</div>
                  <div className="text-[11px] text-muted-foreground font-mono truncate">
                    {w.loginUsername}
                  </div>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleDelete(w)}
                disabled={deleteWorker.isPending}
                className="text-destructive hover:text-destructive shrink-0"
                title="Delete worker"
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* Add worker form toggle */}
      {showForm ? (
        <AddWorkerForm
          agencyId={agencyId}
          onDone={() => setShowForm(false)}
        />
      ) : (
        <Button size="sm" variant="outline" className="w-full" onClick={() => setShowForm(true)}>
          <Plus className="size-4" />
          Add worker
        </Button>
      )}
    </div>
  );
}

function AddWorkerForm({
  agencyId,
  onDone,
}: {
  agencyId: string;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const create = useCreateAgencyWorker(agencyId);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const canSubmit =
    name.trim().length > 0 &&
    username.trim().length >= 3 &&
    password.length >= 6;

  const submit = () => {
    create.mutate(
      {
        name: name.trim(),
        loginUsername: username.trim().toLowerCase(),
        loginPassword: password,
      },
      {
        onSuccess: (w) => {
          toast({
            title: `Worker "${w.name}" created`,
            description: `Login: ${w.loginUsername} / ${password}`,
            duration: 20000,
          });
          onDone();
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

  return (
    <div className="border border-border rounded-xl p-4 space-y-3 bg-card">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        New worker
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="aw-name">Name</Label>
        <Input
          id="aw-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Display name"
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="aw-user">Username</Label>
        <Input
          id="aw-user"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. worker"
          autoComplete="off"
        />
      </div>

      <PasswordField
        id="aw-pass"
        value={password}
        onChange={setPassword}
        minLength={6}
      />

      <div className="flex gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onDone} className="flex-1">
          Cancel
        </Button>
        <Button size="sm" onClick={submit} disabled={!canSubmit || create.isPending} className="flex-1">
          {create.isPending && <Loader2 className="size-4 animate-spin" />}
          Create
        </Button>
      </div>
    </div>
  );
}
