"use client";

import { useState } from "react";
import { Layers, Pencil, Trash2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSession } from "@/lib/auth/auth.hooks";
import { isManager } from "@/lib/auth/roles";
import { useWorkers } from "@/lib/workers/workers.hooks";
import { useInfluencers } from "@/lib/influencers/influencers.hooks";
import { AddWorkerDialog } from "@/components/workers/AddWorkerDialog";
import { EditWorkerDialog } from "@/components/workers/EditWorkerDialog";
import { DeleteWorkerDialog } from "@/components/workers/DeleteWorkerDialog";
import type { Worker } from "@/lib/workers/types";

export default function WorkersPage() {
  const { data: session } = useSession();
  const canManage = isManager(session?.role);

  const workersQ = useWorkers({ enabled: canManage });
  const workers = workersQ.data ?? [];

  const influencersQ = useInfluencers({ enabled: canManage });
  const influencers = influencersQ.data ?? [];

  const influencerNameById = Object.fromEntries(
    influencers.map((inf) => [inf._id, inf.name]),
  );

  const [editTarget, setEditTarget] = useState<Worker | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Worker | null>(null);

  if (!canManage) {
    return (
      <AppShell>
        <div className="px-6 py-12 max-w-2xl mx-auto">
          <div className="card-surface rounded-xl p-8 text-center text-sm text-muted-foreground">
            Only agency owners and admins can manage workers.
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-6 py-6 max-w-5xl">
        <header className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Layers className="size-5 text-primary" />
              Workers
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Staff who enter weekly data. Workers see stats but no financial figures.
            </p>
          </div>
          <AddWorkerDialog />
        </header>

        <div className="card-surface rounded-xl overflow-hidden">
          {workersQ.isLoading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : workers.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <p>No workers yet.</p>
              <p className="mt-1 text-xs">
                Click <strong className="text-foreground">Add worker</strong> to create the first one.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Assigned influencers</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {workers.map((w) => {
                  const assignedNames = w.assignedInfluencerIds
                    .map((id) => influencerNameById[id])
                    .filter(Boolean);
                  return (
                    <TableRow key={w._id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="size-7 rounded-full bg-gradient-primary grid place-items-center shrink-0">
                            <span className="text-primary-foreground text-[11px] font-semibold">
                              {(w.name[0] ?? "?").toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-sm">{w.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground font-mono">
                          {w.loginUsername}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {assignedNames.length > 0 ? assignedNames.join(", ") : "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setEditTarget(w)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteTarget(w)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <EditWorkerDialog
        worker={editTarget}
        open={Boolean(editTarget)}
        onOpenChange={(o) => { if (!o) setEditTarget(null); }}
      />
      <DeleteWorkerDialog
        worker={deleteTarget}
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
      />
    </AppShell>
  );
}
