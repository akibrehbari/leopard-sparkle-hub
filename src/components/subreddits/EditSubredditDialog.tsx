"use client";

/**
 * Edit a subreddit's category and linked influencer.
 *
 * The subreddit name itself is immutable — changing it would invalidate
 * the unique index relationship with snapshots and the Reddit slug.
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
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useUpdateSubreddit } from "@/lib/subreddits/subreddits.hooks";
import type { Subreddit } from "@/lib/subreddits/types";

import { CategoryCombobox } from "./CategoryCombobox";
import { InfluencerCombobox } from "./InfluencerCombobox";

interface Props {
  subreddit: Subreddit;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditSubredditDialog({ subreddit, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [category, setCategory] = useState(subreddit.category);
  const [influencerId, setInfluencerId] = useState<string | null>(
    subreddit.influencerId,
  );

  // Reset draft state any time we open with a different subreddit.
  useEffect(() => {
    if (open) {
      setCategory(subreddit.category);
      setInfluencerId(subreddit.influencerId);
    }
  }, [open, subreddit]);

  const update = useUpdateSubreddit();

  const submit = () => {
    update.mutate(
      {
        id: subreddit._id,
        body: {
          category: category.trim(),
          influencerId,
        },
      },
      {
        onSuccess: () => {
          toast({ title: `r/${subreddit.name} updated` });
          onOpenChange(false);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit r/{subreddit.displayName}</DialogTitle>
          <DialogDescription>
            Change the category or linked influencer. The subreddit's name
            can't be changed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <CategoryCombobox value={category} onChange={setCategory} />
          </div>

          <div className="space-y-1.5">
            <Label>Linked influencer</Label>
            <InfluencerCombobox
              value={influencerId}
              onChange={setInfluencerId}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!category.trim() || update.isPending}
          >
            {update.isPending && <Loader2 className="size-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
