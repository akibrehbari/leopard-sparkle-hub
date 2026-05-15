"use client";

/**
 * Weekly data entry dialog for a single subreddit.
 *
 * Lets the operator pick a week and manually log Followers, Contributions,
 * and Weekly Visits. Calls PATCH /api/subreddits/snapshots via
 * `useUpsertSubredditSnapshot`.
 */

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useUpsertSubredditSnapshot } from "@/lib/subreddits/subreddits.hooks";
import type { Subreddit } from "@/lib/subreddits/types";
import { lastNWeeks, weekShortLabel } from "@/lib/utils/week";

interface Props {
  subreddit: Subreddit | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const WEEKS = lastNWeeks(8);

export function SubredditEntryDialog({ subreddit, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const upsert = useUpsertSubredditSnapshot();

  const [weekKey, setWeekKey] = useState<string>(WEEKS[WEEKS.length - 1]);
  const [followers, setFollowers] = useState("");
  const [contributions, setContributions] = useState("");
  const [weeklyVisits, setWeeklyVisits] = useState("");

  // Reset fields whenever the dialog opens for a different subreddit.
  useEffect(() => {
    if (open) {
      setWeekKey(WEEKS[WEEKS.length - 1]);
      setFollowers("");
      setContributions("");
      setWeeklyVisits("");
    }
  }, [open, subreddit?._id]);

  const canSubmit =
    subreddit &&
    weekKey &&
    followers.trim() !== "" &&
    contributions.trim() !== "" &&
    weeklyVisits.trim() !== "" &&
    !isNaN(Number(followers)) &&
    !isNaN(Number(contributions)) &&
    !isNaN(Number(weeklyVisits));

  const handleSubmit = () => {
    if (!subreddit || !canSubmit) return;
    upsert.mutate(
      {
        subredditId: subreddit._id,
        weekKey,
        followers: Number(followers),
        contributions: Number(contributions),
        weeklyVisits: Number(weeklyVisits),
      },
      {
        onSuccess: () => {
          toast({ title: `r/${subreddit.name} — ${weekKey} logged` });
          onOpenChange(false);
        },
        onError: (e) =>
          toast({
            title: "Could not save entry",
            description: (e as Error).message,
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Log weekly data{subreddit ? ` — r/${subreddit.displayName}` : ""}
          </DialogTitle>
          <DialogDescription>
            Select a week and enter the three metrics. Submitting again for the
            same week will overwrite the previous values.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Week</Label>
            <Select value={weekKey} onValueChange={setWeekKey}>
              <SelectTrigger>
                <SelectValue placeholder="Select week" />
              </SelectTrigger>
              <SelectContent>
                {[...WEEKS].reverse().map((wk) => (
                  <SelectItem key={wk} value={wk}>
                    {weekShortLabel(wk)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="entry-followers">Followers</Label>
            <Input
              id="entry-followers"
              type="number"
              min={0}
              value={followers}
              onChange={(e) => setFollowers(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="entry-contributions">Contributions</Label>
            <Input
              id="entry-contributions"
              type="number"
              min={0}
              value={contributions}
              onChange={(e) => setContributions(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="entry-visits">Weekly Visits</Label>
            <Input
              id="entry-visits"
              type="number"
              min={0}
              value={weeklyVisits}
              onChange={(e) => setWeeklyVisits(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || upsert.isPending}>
            {upsert.isPending && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
