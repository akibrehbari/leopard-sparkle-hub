"use client";

/**
 * Active-agency switcher.
 *
 * Sits in the sidebar (above Workspace nav). Behavior depends on session
 * role:
 *
 *   - admin / editor: cmdk popover listing every agency. Picking one POSTs
 *     to /api/agencies/active (cookie write) and resets every tenant-scoped
 *     TanStack query so the next render reflects the newly active tenant.
 *   - agency_owner: renders disabled with the bound agency's name. The
 *     binding lives in the JWT, not the cookie, so there's nothing to swap.
 *   - empty roster (admin/editor with zero agencies): renders a "Create
 *     your first agency" CTA pointing to /agencies.
 *
 * The active agency is read from the `active_agency_id` cookie. The cookie
 * isn't HttpOnly (it's a UI preference), so a small shim reads it on the
 * client without an extra fetch.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useAgencySummaries } from "@/lib/agencies/agencies.hooks";
import { agenciesService } from "@/lib/agencies/agencies.service";
import { useSession } from "@/lib/auth/auth.hooks";
import { isAdmin, isAgencyOwner } from "@/lib/auth/roles";
import { readActiveAgencyCookie } from "@/lib/tenancy/active-agency.client";
import { cn } from "@/lib/utils";

export function AgencySwitcher() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const qc = useQueryClient();

  const summariesQ = useAgencySummaries({ enabled: Boolean(session) });
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Hydrate the active id from the cookie after mount. We keep it in state
  // so a switch updates the trigger label immediately (vs waiting for the
  // cookie read to re-run).
  useEffect(() => {
    if (isAgencyOwner(session?.role)) {
      setActiveId(session?.agencyId ?? null);
      return;
    }
    setActiveId(readActiveAgencyCookie());
  }, [session?.role, session?.agencyId]);

  // Auto-select the first agency for admin/editor sessions that have no
  // active selection. Lands them on a working dashboard instead of a broken
  // empty state on first login. No-op if cookie is already set, the user
  // is an agency_owner, or summaries are still loading.
  useEffect(() => {
    if (!session) return;
    if (isAgencyOwner(session.role)) return;
    if (activeId) return;
    if (summariesQ.isLoading) return;
    const summaries = summariesQ.data ?? [];
    if (summaries.length === 0) return;
    const first = summaries[0];
    void agenciesService.setActive(first._id).then(() => {
      setActiveId(first._id);
      qc.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey?.[0];
          return k !== "auth" && k !== "agencies";
        },
      });
      // Active-agency record drives the topbar links — refetch explicitly
      // since the broad predicate skips every "agencies" key.
      qc.invalidateQueries({ queryKey: ["agencies", "active"] });
    });
  }, [session, activeId, summariesQ.isLoading, summariesQ.data, qc]);

  if (!session) return null;

  const summaries = summariesQ.data ?? [];
  const ownerLocked = isAgencyOwner(session.role);
  const current = summaries.find((a) => a._id === activeId) ?? null;

  // Owner with binding but the agency was deleted from under them — surface
  // a clear "no agency" so the layout isn't blank.
  if (ownerLocked) {
    return (
      <SwitcherShell>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-sidebar-border bg-sidebar-accent/30">
          <Building2 className="size-4 text-primary shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Agency
            </div>
            <div className="text-sm font-medium text-sidebar-foreground truncate">
              {current?.name ?? "—"}
            </div>
          </div>
        </div>
      </SwitcherShell>
    );
  }

  // Admin/editor with no agencies in the system yet.
  if (!summariesQ.isLoading && summaries.length === 0) {
    return (
      <SwitcherShell>
        <Link
          href="/agencies"
          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-dashed border-sidebar-border bg-sidebar-accent/20 hover:bg-sidebar-accent/40 transition-colors text-xs"
        >
          <span className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="size-4" />
            No agencies yet
          </span>
          {isAdmin(session.role) && (
            <span className="flex items-center gap-1 text-primary font-medium">
              <Plus className="size-3" />
              Create
            </span>
          )}
        </Link>
      </SwitcherShell>
    );
  }

  const handleSelect = async (id: string) => {
    if (id === activeId) {
      setOpen(false);
      return;
    }
    setPending(true);
    try {
      await agenciesService.setActive(id);
      setActiveId(id);
      setOpen(false);
      // Wipe every tenant-scoped cache. Easiest correct behavior is to
      // invalidate everything except the auth + agencies queries themselves,
      // which don't change based on tenant.
      await qc.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey?.[0];
          return k !== "auth" && k !== "agencies";
        },
      });
      // Same caveat as the auto-select branch — the predicate above skips
      // all "agencies" keys, so refresh the active record explicitly so
      // the topbar links update.
      await qc.invalidateQueries({ queryKey: ["agencies", "active"] });
    } catch (err) {
      toast({
        title: "Couldn't switch agency",
        description: (err as Error)?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <SwitcherShell>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            disabled={pending || summariesQ.isLoading}
            className="w-full justify-between font-normal h-auto py-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="size-4 text-primary shrink-0" />
              <div className="min-w-0 text-left">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Agency
                </div>
                <div className="text-sm font-medium text-sidebar-foreground truncate">
                  {current?.name ?? "Pick agency..."}
                </div>
              </div>
            </div>
            {pending ? (
              <Loader2 className="size-4 animate-spin opacity-60 shrink-0" />
            ) : (
              <ChevronsUpDown className="size-4 opacity-50 shrink-0" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[var(--radix-popover-trigger-width)]"
          align="start"
        >
          <Command>
            <CommandInput placeholder="Search agencies..." />
            <CommandList>
              <CommandEmpty>No agencies found.</CommandEmpty>
              <CommandGroup>
                {summaries.map((a) => (
                  <CommandItem
                    key={a._id}
                    value={a.name}
                    onSelect={() => handleSelect(a._id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        activeId === a._id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {a.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </SwitcherShell>
  );
}

function SwitcherShell({ children }: { children: React.ReactNode }) {
  return <div className="px-3 pt-3 pb-2">{children}</div>;
}
