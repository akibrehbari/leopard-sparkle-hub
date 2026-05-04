"use client";

/**
 * Agency management page (path: /agencies).
 *
 * Admin-only — the page itself short-circuits to a "forbidden" message
 * for editor / agency_owner sessions. The table shows every agency in
 * the system with counts of related records and the owner username; per
 * row the admin can edit (rename, rotate creds) or delete (cascade).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Building2, Pencil, ShieldAlert, Trash2 } from "lucide-react";

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
import { AddAgencyDialog } from "@/components/agencies/AddAgencyDialog";
import { EditAgencyDialog } from "@/components/agencies/EditAgencyDialog";
import { DeleteAgencyDialog } from "@/components/agencies/DeleteAgencyDialog";
import { useAgencies } from "@/lib/agencies/agencies.hooks";
import { useSession } from "@/lib/auth/auth.hooks";
import { isAdmin } from "@/lib/auth/roles";
import type { Agency } from "@/lib/agencies/types";
import { readActiveAgencyCookie } from "@/lib/tenancy/active-agency.client";

export default function AgenciesPage() {
  const { data: session, isLoading: sessionLoading } = useSession();
  const allowed = isAdmin(session?.role);
  const router = useRouter();

  const agenciesQ = useAgencies({ enabled: allowed });

  const [editTarget, setEditTarget] = useState<Agency | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Agency | null>(null);

  // If the admin nukes the agency they were just operating on, send them
  // home so the cookie can be re-picked by the auto-select effect.
  useEffect(() => {
    if (!deleteTarget) return;
  }, [deleteTarget]);

  if (sessionLoading) {
    return (
      <AppShell>
        <div className="px-6 py-6 max-w-6xl">
          <Skeleton className="h-8 w-48" />
        </div>
      </AppShell>
    );
  }

  if (!allowed) {
    return (
      <AppShell>
        <div className="px-6 py-12 max-w-2xl mx-auto">
          <div className="card-surface rounded-xl p-8 text-center">
            <div className="mx-auto size-12 rounded-full bg-destructive/10 grid place-items-center mb-4">
              <ShieldAlert className="size-5 text-destructive" />
            </div>
            <h1 className="text-lg font-semibold mb-1">
              Admin access required
            </h1>
            <p className="text-sm text-muted-foreground">
              Only administrators can create or manage agencies.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  const agencies = agenciesQ.data ?? [];

  return (
    <AppShell>
      <div className="px-6 py-6 max-w-6xl">
        <header className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Building2 className="size-5 text-primary" />
              Agencies
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Each agency is an isolated tenant — its influencers,
              subreddits, weekly entries, and dashboards are visible only
              to admins/editors and to the agency owner you create here.
            </p>
          </div>
          <AddAgencyDialog />
        </header>

        <div className="card-surface rounded-xl overflow-hidden">
          {agenciesQ.isLoading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-md" />
              ))}
            </div>
          ) : agenciesQ.isError ? (
            <div className="flex items-start gap-2 p-6 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">Failed to load agencies</div>
                <div className="text-destructive/80 mt-0.5 text-xs">
                  {(agenciesQ.error as Error).message}
                </div>
              </div>
            </div>
          ) : agencies.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <p>No agencies yet.</p>
              <p className="mt-1 text-xs">
                Click <strong className="text-foreground">Add agency</strong>{" "}
                above to create your first one. The first agency
                automatically becomes your active workspace.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Owner login</TableHead>
                  <TableHead className="text-right">Influencers</TableHead>
                  <TableHead className="text-right">Subreddits</TableHead>
                  <TableHead className="text-right">Weekly entries</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {agencies.map((a) => (
                  <AgencyRow
                    key={a._id}
                    agency={a}
                    onEdit={() => setEditTarget(a)}
                    onDelete={() => setDeleteTarget(a)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <EditAgencyDialog
        agency={editTarget}
        open={Boolean(editTarget)}
        onOpenChange={(o) => {
          if (!o) setEditTarget(null);
        }}
      />

      <DeleteAgencyDialog
        agency={deleteTarget}
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
        onDeleted={(deletedId) => {
          // If the admin just deleted the agency they were operating in,
          // bounce them to the dashboard root — the AgencySwitcher's auto-
          // pick effect will land them on whatever's left (or surface the
          // empty state).
          const active = readActiveAgencyCookie();
          if (active === deletedId) router.replace("/");
        }}
      />
    </AppShell>
  );
}

/* -------------------------------------------------------------------------- */

function AgencyRow({
  agency,
  onEdit,
  onDelete,
}: {
  agency: Agency;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const counts = agency.counts ?? {
    influencers: 0,
    subreddits: 0,
    weeklyEntries: 0,
  };
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-md bg-primary/15 grid place-items-center shrink-0">
            <Building2 className="size-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate">{agency.name}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              Created{" "}
              {new Date(agency.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <code className="text-xs px-2 py-0.5 rounded bg-muted text-foreground font-mono">
          {agency.ownerUsername}
        </code>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {counts.influencers}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {counts.subreddits}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {counts.weeklyEntries}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Button size="icon" variant="ghost" onClick={onEdit} title="Edit">
            <Pencil className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
            className="text-destructive hover:text-destructive"
            title="Delete"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
