"use client";

/**
 * "Sync subreddits" button.
 *
 * Triggers `useSyncSubreddits()`, surfaces a loading spinner while the
 * batch is in flight, then toasts a per-batch summary including the names
 * of any failures so the operator knows which rows to retry.
 */

import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSyncSubreddits } from "@/lib/subreddits/subreddits.hooks";

export function SyncSubredditsButton() {
  const { toast } = useToast();
  const sync = useSyncSubreddits();

  const handleClick = () => {
    sync.mutate(undefined, {
      onSuccess: (res) => {
        if (res.failed.length === 0) {
          toast({
            title: `Synced ${res.synced} of ${res.total}`,
            description: `Week ${res.weekKey}`,
          });
        } else {
          const names = res.failed.map((f) => f.name).join(", ");
          toast({
            title: `${res.synced} synced, ${res.failed.length} failed`,
            description: `Failed: ${names}`,
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

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={sync.isPending}>
      {sync.isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <RefreshCw className="size-4" />
      )}
      {sync.isPending ? "Syncing..." : "Sync subreddits"}
    </Button>
  );
}
