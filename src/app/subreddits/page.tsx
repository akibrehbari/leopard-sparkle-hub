"use client";

/**
 * Subreddits roster page (path: /subreddits).
 *
 * - Sync subreddits button (writes a fresh weekly snapshot for each row).
 * - Add subreddit dialog (validates the name with Reddit, seeds metadata).
 * - Filters (search / category / linked influencer).
 * - Sortable subreddits table with per-row re-sync, edit, delete.
 */

import { useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { AddSubredditDialog } from "@/components/subreddits/AddSubredditDialog";
import {
  EMPTY_FILTERS,
  SubredditFilters,
  applyFilters,
  type SubredditFilterDraft,
} from "@/components/subreddits/SubredditFilters";
import { SubredditTable } from "@/components/subreddits/SubredditTable";
import { SyncSubredditsButton } from "@/components/subreddits/SyncSubredditsButton";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth/auth.hooks";
import { isAdmin, isEditorOrAdmin } from "@/lib/auth/roles";
import { useInfluencers } from "@/lib/influencers/influencers.hooks";
import { useSubreddits } from "@/lib/subreddits/subreddits.hooks";

export default function SubredditsPage() {
  const { data: subreddits, isLoading, isError, error } = useSubreddits();
  const { data: influencers } = useInfluencers();
  const { data: session } = useSession();
  const canEdit = isAdmin(session?.role);
  const canSync = isEditorOrAdmin(session?.role);
  const [filters, setFilters] = useState<SubredditFilterDraft>(EMPTY_FILTERS);

  const filtered = useMemo(
    () => (subreddits ? applyFilters(subreddits, filters) : []),
    [subreddits, filters],
  );

  return (
    <AppShell>
      <div className="px-6 py-6 max-w-7xl mx-auto">
        <header className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-semibold">Subreddits</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Track subscriber growth, weekly post volume, and the top
              post for each subreddit. Run a sync every Sunday to refresh
              the current week's snapshot.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canSync && <SyncSubredditsButton />}
            {canEdit && <AddSubredditDialog />}
          </div>
        </header>

        {isLoading ? (
          <div className="card-surface rounded-xl p-6 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        ) : isError ? (
          <div className="card-surface rounded-xl p-6 text-sm text-destructive">
            Failed to load subreddits: {(error as Error).message}
          </div>
        ) : !subreddits || subreddits.length === 0 ? (
          <div className="card-surface rounded-xl p-12 text-center text-sm text-muted-foreground">
            <p>No subreddits tracked yet.</p>
            {canEdit ? (
              <p className="mt-1 text-xs">
                Click <strong className="text-foreground">Add subreddit</strong>{" "}
                above to start tracking your first one.
              </p>
            ) : (
              <p className="mt-1 text-xs">
                Ask an admin to add the first subreddit.
              </p>
            )}
          </div>
        ) : (
          <>
            <SubredditFilters
              filters={filters}
              onChange={setFilters}
              influencers={influencers ?? []}
            />
            <SubredditTable
              subreddits={filtered}
              emptyMessage="No subreddits match the current filters."
            />
          </>
        )}
      </div>
    </AppShell>
  );
}
