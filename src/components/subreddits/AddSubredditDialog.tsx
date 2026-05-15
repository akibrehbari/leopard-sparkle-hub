"use client";

/**
 * "Add subreddit" dialog.
 *
 * Collects: subreddit name (required, normalized server-side), category
 * (free-form with autocomplete from existing categories), and an optional
 * influencer link via combobox.
 */

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useCreateSubreddit } from "@/lib/subreddits/subreddits.hooks";

import { CategoryCombobox } from "./CategoryCombobox";
import { InfluencerCombobox } from "./InfluencerCombobox";

interface Props {
  /** Optionally render a custom trigger button. */
  trigger?: React.ReactNode;
}

export function AddSubredditDialog({ trigger }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [influencerId, setInfluencerId] = useState<string | null>(null);

  const isPersonal = category === "personal";

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    if (cat !== "personal") setInfluencerId(null);
  };

  const create = useCreateSubreddit();

  const reset = () => {
    setName("");
    setCategory("");
    setInfluencerId(null);
  };

  const submit = () => {
    create.mutate(
      {
        name: name.trim(),
        category: category.trim(),
        influencerId,
      },
      {
        onSuccess: (sub) => {
          toast({ title: `r/${sub.name} added` });
          reset();
          setOpen(false);
        },
        onError: (e) =>
          toast({
            title: "Could not add subreddit",
            description: (e as Error).message,
            variant: "destructive",
          }),
      },
    );
  };

  const canSubmit = name.trim().length > 0 && category.trim().length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="size-4" />
            Add subreddit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add subreddit</DialogTitle>
          <DialogDescription>
            Enter the subreddit name and pick a category.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="sub-name">Subreddit name</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                r/
              </span>
              <Input
                id="sub-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="askreddit"
                className="pl-7"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Category</Label>
            <CategoryCombobox value={category} onChange={handleCategoryChange} />
          </div>

          {isPersonal && (
            <div className="space-y-1.5">
              <Label>Linked influencer</Label>
              <InfluencerCombobox value={influencerId} onChange={setInfluencerId} />
              <p className="text-[11px] text-muted-foreground">
                This subreddit will appear on the linked influencer's dashboard.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit || create.isPending}>
            {create.isPending && <Loader2 className="size-4 animate-spin" />}
            Add subreddit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
