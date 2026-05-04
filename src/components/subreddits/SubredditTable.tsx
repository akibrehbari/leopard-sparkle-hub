"use client";

/**
 * Reusable, sortable subreddits table.
 *
 * Used in three places:
 *   1. /subreddits  — full roster with all actions.
 *   2. All Models dashboard — full roster, no per-row actions hidden.
 *   3. Per-influencer dashboard — `filterByInfluencerId` narrows to the
 *      subreddits that belong to one model.
 *
 * Sorting is client-side. We deliberately keep this component pure (no
 * data fetching) so the parent page can decide how to pass data in.
 */

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { isAdmin, isEditorOrAdmin } from "@/lib/auth/roles";
import { useInfluencers } from "@/lib/influencers/influencers.hooks";
import { categoryLabel } from "@/lib/subreddits/categories";
import {
  useDeleteSubreddit,
  useSyncSubreddit,
} from "@/lib/subreddits/subreddits.hooks";
import type { SubredditWithLatest } from "@/lib/subreddits/types";
import { formatNumber, formatSignedInt } from "@/lib/utils/format";
import { pkt } from "@/lib/utils/dayjs";
import { cn } from "@/lib/utils";

import { EditSubredditDialog } from "./EditSubredditDialog";

type SortKey =
  | "name"
  | "category"
  | "influencer"
  | "subscribers"
  | "weeklyDelta"
  | "activeUsers"
  | "postsLast7d"
  | "lastSyncedAt";
type SortDir = "asc" | "desc";

interface Props {
  subreddits: SubredditWithLatest[];
  /** When set, hide rows whose `influencerId` doesn't match. */
  filterByInfluencerId?: string;
  /** Hide row-level edit/delete/re-sync actions (e.g. on the share page). */
  readOnly?: boolean;
  /**
   * Compact variant: smaller paddings, hides a couple of less-critical
   * columns. Useful inside dashboard sections where vertical density matters.
   */
  compact?: boolean;
  /** Optional custom empty-state message. */
  emptyMessage?: string;
  /**
   * Optional pre-fetched name lookup keyed by influencer id. When provided,
   * the table uses it instead of calling `useInfluencers()`. Lets the
   * unauthenticated share page render the linked-model column without
   * hitting an admin-only API.
   */
  prefetchedInfluencers?: Array<{ _id: string; name: string }>;
}

export function SubredditTable({
  subreddits,
  filterByInfluencerId,
  readOnly = false,
  compact = false,
  emptyMessage,
  prefetchedInfluencers,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("subscribers");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [editing, setEditing] = useState<SubredditWithLatest | null>(null);

  const { data: session } = useSession();
  // Editors keep the per-row "re-sync" action (they can sync subreddits) but
  // lose Edit and Delete. Agency owners are read-only — they don't get sync
  // either. `readOnly` from the parent (e.g. share page) hides every action
  // regardless of role.
  const canEdit = !readOnly && isAdmin(session?.role);
  const canResync = !readOnly && isEditorOrAdmin(session?.role);
  const showActionsColumn = canEdit || canResync;

  // Skip the auth-protected /api/influencers call when the parent has
  // already supplied the name lookup (share page passes `roster`).
  const usePrefetched = Boolean(prefetchedInfluencers);
  const { data: fetchedInfluencers } = useInfluencers({
    enabled: !usePrefetched,
  });
  const influencerById = useMemo(() => {
    const source = usePrefetched
      ? prefetchedInfluencers ?? []
      : fetchedInfluencers ?? [];
    return new Map(source.map((i) => [i._id, i] as const));
  }, [usePrefetched, prefetchedInfluencers, fetchedInfluencers]);

  const filtered = useMemo(() => {
    if (!filterByInfluencerId) return subreddits;
    return subreddits.filter((s) => s.influencerId === filterByInfluencerId);
  }, [subreddits, filterByInfluencerId]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => compareSubreddits(a, b, sortKey, influencerById));
    return sortDir === "asc" ? arr : arr.reverse();
  }, [filtered, sortKey, sortDir, influencerById]);

  const handleHeaderClick = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Numeric columns are usually most useful biggest-first.
      setSortDir(NUMERIC_KEYS.has(key) ? "desc" : "asc");
    }
  };

  if (sorted.length === 0) {
    return (
      <div className="card-surface rounded-xl p-10 text-center text-sm text-muted-foreground">
        {emptyMessage ?? "No subreddits to show yet."}
      </div>
    );
  }

  return (
    <>
      <div className="card-surface rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader
                label="Subreddit"
                sortKey="name"
                active={sortKey}
                dir={sortDir}
                onClick={handleHeaderClick}
              />
              <SortableHeader
                label="Category"
                sortKey="category"
                active={sortKey}
                dir={sortDir}
                onClick={handleHeaderClick}
              />
              {!filterByInfluencerId && (
                <SortableHeader
                  label="Linked model"
                  sortKey="influencer"
                  active={sortKey}
                  dir={sortDir}
                  onClick={handleHeaderClick}
                />
              )}
              <SortableHeader
                label="Subscribers"
                sortKey="subscribers"
                active={sortKey}
                dir={sortDir}
                onClick={handleHeaderClick}
                align="right"
              />
              <SortableHeader
                label="Weekly Δ"
                sortKey="weeklyDelta"
                active={sortKey}
                dir={sortDir}
                onClick={handleHeaderClick}
                align="right"
              />
              {!compact && (
                <SortableHeader
                  label="Active"
                  sortKey="activeUsers"
                  active={sortKey}
                  dir={sortDir}
                  onClick={handleHeaderClick}
                  align="right"
                />
              )}
              <SortableHeader
                label="Posts/wk"
                sortKey="postsLast7d"
                active={sortKey}
                dir={sortDir}
                onClick={handleHeaderClick}
                align="right"
              />
              {!compact && <TableHead>Top post</TableHead>}
              <SortableHeader
                label="Last synced"
                sortKey="lastSyncedAt"
                active={sortKey}
                dir={sortDir}
                onClick={handleHeaderClick}
              />
              {showActionsColumn && (
                <TableHead className="w-32 text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((sub) => (
              <SubredditRow
                key={sub._id}
                sub={sub}
                influencerName={
                  sub.influencerId
                    ? influencerById.get(sub.influencerId)?.name ?? null
                    : null
                }
                showInfluencerColumn={!filterByInfluencerId}
                compact={compact}
                canEdit={canEdit}
                canResync={canResync}
                onEdit={() => setEditing(sub)}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {canEdit && editing && (
        <EditSubredditDialog
          subreddit={editing}
          open={Boolean(editing)}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */

const NUMERIC_KEYS = new Set<SortKey>([
  "subscribers",
  "weeklyDelta",
  "activeUsers",
  "postsLast7d",
  "lastSyncedAt",
]);

function compareSubreddits(
  a: SubredditWithLatest,
  b: SubredditWithLatest,
  key: SortKey,
  influencerById: Map<string, { name: string }>,
): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "category":
      return a.category.localeCompare(b.category);
    case "influencer": {
      const an = a.influencerId ? influencerById.get(a.influencerId)?.name ?? "" : "";
      const bn = b.influencerId ? influencerById.get(b.influencerId)?.name ?? "" : "";
      // Empty influencer names sort last regardless of direction reversal.
      if (!an && !bn) return 0;
      if (!an) return 1;
      if (!bn) return -1;
      return an.localeCompare(bn);
    }
    case "subscribers":
      return (a.latest?.subscribers ?? 0) - (b.latest?.subscribers ?? 0);
    case "weeklyDelta":
      return (a.weeklyDelta ?? 0) - (b.weeklyDelta ?? 0);
    case "activeUsers":
      return (a.latest?.activeUsers ?? 0) - (b.latest?.activeUsers ?? 0);
    case "postsLast7d":
      return (a.latest?.postsLast7d ?? 0) - (b.latest?.postsLast7d ?? 0);
    case "lastSyncedAt": {
      const at = a.lastSyncedAt ? new Date(a.lastSyncedAt).getTime() : 0;
      const bt = b.lastSyncedAt ? new Date(b.lastSyncedAt).getTime() : 0;
      return at - bt;
    }
  }
}

/* -------------------------------------------------------------------------- */

interface SortableHeaderProps {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  dir: SortDir;
  onClick: (key: SortKey) => void;
  align?: "left" | "right";
}

function SortableHeader({
  label,
  sortKey,
  active,
  dir,
  onClick,
  align = "left",
}: SortableHeaderProps) {
  const isActive = active === sortKey;
  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium hover:text-foreground transition-colors",
          isActive ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        {isActive ? (
          dir === "asc" ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : (
          <ArrowUpDown className="size-3 opacity-50" />
        )}
      </button>
    </TableHead>
  );
}

/* -------------------------------------------------------------------------- */

interface RowProps {
  sub: SubredditWithLatest;
  influencerName: string | null;
  showInfluencerColumn: boolean;
  compact: boolean;
  /** Admin-only: edit + delete actions. */
  canEdit: boolean;
  /** Admin + editor: per-row "re-sync" action. */
  canResync: boolean;
  onEdit: () => void;
}

function SubredditRow({
  sub,
  influencerName,
  showInfluencerColumn,
  compact,
  canEdit,
  canResync,
  onEdit,
}: RowProps) {
  const { toast } = useToast();
  const syncOne = useSyncSubreddit();
  const remove = useDeleteSubreddit();

  const handleSync = () => {
    syncOne.mutate(sub._id, {
      onSuccess: (res) => {
        if (res.failed.length === 0) {
          toast({ title: `r/${sub.name} synced` });
        } else {
          toast({
            title: `r/${sub.name} sync failed`,
            description: res.failed[0]?.error,
            variant: "destructive",
          });
        }
      },
      onError: (e) =>
        toast({
          title: "Sync failed",
          description: (e as Error).message,
          variant: "destructive",
        }),
    });
  };

  const handleDelete = () => {
    if (!confirm(`Stop tracking r/${sub.name}? Snapshots will be retained.`)) return;
    remove.mutate(sub._id, {
      onSuccess: () => toast({ title: `r/${sub.name} removed` }),
      onError: (e) =>
        toast({
          title: "Delete failed",
          description: (e as Error).message,
          variant: "destructive",
        }),
    });
  };

  const subs = sub.latest?.subscribers ?? null;
  const delta = sub.weeklyDelta;
  const active = sub.latest?.activeUsers ?? null;
  const posts = sub.latest?.postsLast7d ?? null;
  const top = sub.latest?.topPost ?? null;

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2 min-w-0">
          <a
            href={`https://www.reddit.com/r/${sub.name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium truncate hover:underline"
          >
            r/{sub.displayName}
          </a>
          {sub.over18 && (
            <Badge variant="destructive" className="h-4 px-1 text-[9px] leading-none">
              NSFW
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className="text-[10px] font-normal">
          {categoryLabel(sub.category)}
        </Badge>
      </TableCell>
      {showInfluencerColumn && (
        <TableCell>
          <span className="text-xs text-muted-foreground truncate">
            {influencerName ?? "—"}
          </span>
        </TableCell>
      )}
      <TableCell className="text-right tabular-nums">
        {subs !== null ? formatNumber(subs) : "—"}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {delta === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span
            className={cn(
              "text-xs",
              delta > 0
                ? "text-emerald-400"
                : delta < 0
                  ? "text-rose-400"
                  : "text-muted-foreground",
            )}
          >
            {formatSignedInt(delta)}
          </span>
        )}
      </TableCell>
      {!compact && (
        <TableCell className="text-right tabular-nums">
          {active !== null ? formatNumber(active) : "—"}
        </TableCell>
      )}
      <TableCell className="text-right tabular-nums">
        {posts !== null ? formatNumber(posts) : "—"}
      </TableCell>
      {!compact && (
        <TableCell className="max-w-[260px]">
          {top ? (
            <a
              href={top.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-xs hover:underline"
              title={`${top.title} · u/${top.author} · ${formatNumber(top.score)}`}
            >
              <span className="text-muted-foreground tabular-nums mr-1">
                ↑{formatNumber(top.score)}
              </span>
              {top.title}
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>
      )}
      <TableCell>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {sub.lastSyncedAt ? pkt(sub.lastSyncedAt).format("MMM D") : "Never"}
        </span>
      </TableCell>
      {(canResync || canEdit) && (
        <TableCell>
          <div className="flex items-center justify-end gap-1">
            {canResync && (
              <Button
                size="icon"
                variant="ghost"
                onClick={handleSync}
                disabled={syncOne.isPending}
                title="Re-sync this subreddit"
              >
                {syncOne.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
              </Button>
            )}
            {canEdit && (
              <Button size="icon" variant="ghost" onClick={onEdit} title="Edit">
                <Pencil className="size-4" />
              </Button>
            )}
            {canEdit && (
            <Button
              size="icon"
              variant="ghost"
              onClick={handleDelete}
              disabled={remove.isPending}
              className="text-destructive hover:text-destructive"
              title="Delete"
            >
              {remove.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
            </Button>
            )}
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}
