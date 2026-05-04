"use client";

/**
 * AppShell — the single sidebar layout used by every authenticated page.
 *
 * Sections, top to bottom:
 *   1. Brand
 *   2. Top-level nav (Influencers, Weekly tracker)
 *   3. "Dashboard" — the All Models entry + every influencer in the DB.
 *      Clicking one always navigates to /?id=<id> (or /?id=all for aggregate),
 *      which the dashboard reads via useSearchParams.
 *   4. Logout footer
 *
 * `useSearchParams` is wrapped in a Suspense boundary so the rest of the
 * page tree (including children) doesn't get suspended when the URL ?id=
 * changes.
 */

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Layers,
  ListChecks,
  LogOut,
  MessagesSquare,
  Plus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useInfluencers } from "@/lib/influencers/influencers.hooks";
import { useLogout, useSession } from "@/lib/auth/auth.hooks";
import type { Influencer } from "@/lib/influencers/types";
import { PLATFORMS, PLATFORM_KEYS } from "@/lib/platforms/registry";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden lg:flex w-72 flex-col border-r border-border bg-sidebar shrink-0 h-screen sticky top-0">
        <BrandHeader />
        <Suspense fallback={<SidebarFallback />}>
          <SidebarBody />
        </Suspense>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function BrandHeader() {
  return (
    <div className="px-6 py-5 border-b border-sidebar-border">
      <div className="flex items-center gap-2.5">
        <div className="size-9 rounded-lg bg-gradient-primary grid place-items-center shadow-glow">
          <span className="text-primary-foreground font-bold text-sm">eL</span>
        </div>
        <div>
          <div className="text-sm font-semibold text-sidebar-foreground leading-tight">
            eLeopards
          </div>
          <div className="text-[11px] text-muted-foreground">Clients Dashboard</div>
        </div>
      </div>
    </div>
  );
}

function SidebarBody() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const selectedDashboardId = search.get("id");
  const isDashboard = pathname === "/";

  const { data: influencers, isLoading, isError, error } = useInfluencers();
  const list = influencers ?? [];
  const { data: session } = useSession();
  const logout = useLogout();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => router.replace("/login"),
    });
  };

  const isAllModelsActive =
    isDashboard && (!selectedDashboardId || selectedDashboardId === "all");

  return (
    <>
      <nav className="px-3 py-4 space-y-1">
        <SectionLabel>Workspace</SectionLabel>
        <NavRow
          href="/influencers"
          icon={Users}
          label="Influencers"
          active={pathname.startsWith("/influencers")}
        />
        <NavRow
          href="/subreddits"
          icon={MessagesSquare}
          label="Subreddits"
          active={pathname.startsWith("/subreddits")}
        />
        <NavRow
          href="/tracker"
          icon={ListChecks}
          label="Weekly tracker"
          active={pathname.startsWith("/tracker")}
        />
      </nav>

      <div className="px-3 pb-4 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between px-3 pb-2">
          <SectionLabel className="pb-0">Dashboard</SectionLabel>
          {!isLoading && (
            <span className="text-[10px] text-muted-foreground">{list.length}</span>
          )}
        </div>

        <DashboardLink
          href="/?id=all"
          active={isAllModelsActive}
          icon={Layers}
          label="All Models"
        />

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin mt-1">
          {isLoading ? (
            <div className="space-y-2 px-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-2 py-2.5 rounded-lg"
                >
                  <Skeleton className="size-8 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-2.5 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="flex items-start gap-2 mx-1 p-3 rounded-lg bg-destructive/10 text-destructive border border-destructive/30 text-xs">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">Couldn’t load influencers</div>
                <div className="text-destructive/80 mt-0.5">
                  {(error as Error)?.message ?? "Unknown error"}
                </div>
              </div>
            </div>
          ) : list.length === 0 ? (
            <div className="mx-1 mt-2 p-3 rounded-lg bg-secondary/40 border border-border text-xs text-muted-foreground space-y-2">
              <div>No influencers yet.</div>
              <Link href="/influencers">
                <Button variant="outline" size="sm" className="w-full">
                  <Plus className="size-3" />
                  Add an influencer
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {list.map((inf) => (
                <InfluencerRow
                  key={inf._id}
                  inf={inf}
                  active={isDashboard && selectedDashboardId === inf._id}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-3 py-3 border-t border-sidebar-border space-y-2">
        <div className="px-3 text-[10px] text-muted-foreground">
          Signed in as{" "}
          <span className="text-foreground font-medium">
            {session?.username ?? "—"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={handleLogout}
          disabled={logout.isPending}
        >
          <LogOut className="size-4" />
          Sign out
        </Button>
        <div className="px-3 pt-1 text-[10px] text-muted-foreground border-t border-sidebar-border/50">
          v0.3 · eLeopards · Internal use
        </div>
      </div>
    </>
  );
}

function SidebarFallback() {
  return (
    <div className="flex-1 px-3 py-4 space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-3 pb-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium",
        className,
      )}
    >
      {children}
    </div>
  );
}

function NavRow({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/50",
      )}
    >
      <Icon className="size-4 text-primary" />
      <span className="font-medium">{label}</span>
    </Link>
  );
}

function DashboardLink({
  href,
  active,
  icon: Icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/50",
      )}
    >
      <Icon className="size-4 text-primary" />
      <span className="font-medium">{label}</span>
    </Link>
  );
}

function InfluencerRow({ inf, active }: { inf: Influencer; active: boolean }) {
  const display = inf.name || "Untitled";
  const handleCount = PLATFORM_KEYS.filter((k) => inf.handles[k]).length;

  return (
    <Link
      href={`/?id=${inf._id}`}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-primary/20"
          : "text-sidebar-foreground hover:bg-sidebar-accent/50",
      )}
    >
      <div className="size-8 rounded-full bg-gradient-primary grid place-items-center shrink-0 ring-1 ring-border">
        <span className="text-primary-foreground text-xs font-semibold">
          {(display[0] ?? "?").toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{display}</div>
        {handleCount > 0 && (
          <div className="text-[11px] text-muted-foreground truncate">
            {handleCount} platform{handleCount === 1 ? "" : "s"} linked
          </div>
        )}
      </div>
      <PlatformBadges inf={inf} />
    </Link>
  );
}

function PlatformBadges({ inf }: { inf: Influencer }) {
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      {PLATFORM_KEYS.map((key) => {
        if (!inf.handles[key]) return null;
        const def = PLATFORMS[key];
        return (
          <span
            key={key}
            title={`Has ${def.label} handle`}
            className="text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded leading-none border border-border"
            style={{ background: `${def.color}20`, color: def.color }}
          >
            {def.short}
          </span>
        );
      })}
    </div>
  );
}
