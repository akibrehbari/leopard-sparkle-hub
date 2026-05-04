"use client";

/**
 * Filter controls for the subreddits list.
 *
 * Owns no fetch — the parent passes the full `subreddits` list and a
 * filter draft. We expose changes via callbacks, and parent re-derives
 * the filtered list before passing to <SubredditTable>.
 */

import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SUBREDDIT_CATEGORIES } from "@/lib/subreddits/categories";

export interface SubredditFilterDraft {
  search: string;
  category: string; // "" means "all"
  influencerId: string; // "" means "all", "none" means "unlinked only"
}

export const EMPTY_FILTERS: SubredditFilterDraft = {
  search: "",
  category: "",
  influencerId: "",
};

interface Props {
  filters: SubredditFilterDraft;
  onChange: (next: SubredditFilterDraft) => void;
  influencers: Array<{ _id: string; name: string }>;
}

export function SubredditFilters({
  filters,
  onChange,
  influencers,
}: Props) {
  const update = (patch: Partial<SubredditFilterDraft>) =>
    onChange({ ...filters, ...patch });

  const hasAny =
    filters.search.length > 0 ||
    filters.category.length > 0 ||
    filters.influencerId.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          placeholder="Search subreddits..."
          className="pl-8 h-9"
        />
      </div>

      <Select
        value={filters.category || "__all"}
        onValueChange={(v) => update({ category: v === "__all" ? "" : v })}
      >
        <SelectTrigger className="h-9 w-[180px]">
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">All categories</SelectItem>
          {SUBREDDIT_CATEGORIES.map((c) => (
            <SelectItem key={c.key} value={c.key}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.influencerId || "__all"}
        onValueChange={(v) =>
          update({ influencerId: v === "__all" ? "" : v })
        }
      >
        <SelectTrigger className="h-9 w-[200px]">
          <SelectValue placeholder="All models" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">All models</SelectItem>
          <SelectItem value="__none">Unlinked</SelectItem>
          {influencers.map((i) => (
            <SelectItem key={i._id} value={i._id}>
              {i.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasAny && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onChange(EMPTY_FILTERS)}
        >
          <X className="size-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}

/**
 * Apply a filter draft to a subreddits array. Re-exported so dashboard
 * sections can use the same matcher when they wire filters in.
 */
export function applyFilters<T extends { name: string; displayName: string; category: string; influencerId: string | null }>(
  list: T[],
  filters: SubredditFilterDraft,
): T[] {
  const search = filters.search.trim().toLowerCase();
  return list.filter((s) => {
    if (filters.category && s.category !== filters.category) return false;
    if (filters.influencerId === "__none" && s.influencerId !== null) return false;
    if (
      filters.influencerId &&
      filters.influencerId !== "__none" &&
      s.influencerId !== filters.influencerId
    ) {
      return false;
    }
    if (search) {
      const hay = `${s.name} ${s.displayName} ${s.category}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}
