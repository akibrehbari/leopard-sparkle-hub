"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InfluencerNotes } from "./InfluencerNotes";
import type { Influencer } from "@/lib/influencers/types";

interface Props {
  influencer: Influencer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit?: boolean;
}

export function InfluencerNotesDialog({ influencer, open, onOpenChange, canEdit = true }: Props) {
  if (!influencer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Notes — {influencer.name}</DialogTitle>
          <DialogDescription>
            Internal notes only visible to staff. Not shown to the influencer.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <InfluencerNotes
            influencerId={influencer._id}
            initialMarketingNotes={influencer.marketingNotes}
            initialOfNotes={influencer.ofNotes}
            canEdit={canEdit}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
