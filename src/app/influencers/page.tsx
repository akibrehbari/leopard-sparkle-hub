"use client";

import { useState } from "react";
import { FileText, GripVertical, MessageSquarePlus, Pencil, Star, Trash2, Users } from "lucide-react";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { isManager, canEnterData } from "@/lib/auth/roles";
import {
  useInfluencers,
  useReorderInfluencers,
} from "@/lib/influencers/influencers.hooks";
import { useCreateReview } from "@/lib/influencers/reviews.hooks";
import { AddInfluencerDialog } from "@/components/influencers/AddInfluencerDialog";
import { EditInfluencerDialog } from "@/components/influencers/EditInfluencerDialog";
import { DeleteInfluencerDialog } from "@/components/influencers/DeleteInfluencerDialog";
import { InfluencerNotesDialog } from "@/components/influencers/InfluencerNotesDialog";
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
import { Button as Btn } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { Influencer } from "@/lib/influencers/types";
import { PLATFORMS, PLATFORM_KEYS, type PlatformKey } from "@/lib/platforms/registry";

const HANDLE_PREFIX: Record<PlatformKey, string> = {
  reddit: "u/",
  instagram: "@",
  x: "@",
  onlyfans: "@",
};

export default function InfluencersPage() {
  const { data: session } = useSession();
  const canEdit = isManager(session?.role);
  const canReview = canEnterData(session?.role);

  const { data: influencers, isLoading, isError, error } = useInfluencers();
  const reorder = useReorderInfluencers();

  // Local optimistic order — keeps the UI snappy while the server call is in-flight
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);

  const [editTarget, setEditTarget] = useState<Influencer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Influencer | null>(null);
  const [reviewTarget, setReviewTarget] = useState<Influencer | null>(null);
  const [notesTarget, setNotesTarget] = useState<Influencer | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const orderedInfluencers = (() => {
    if (!influencers) return [];
    if (!localOrder) return influencers;
    const map = new Map(influencers.map((i) => [i._id, i]));
    return localOrder.map((id) => map.get(id)).filter(Boolean) as Influencer[];
  })();

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const ids = orderedInfluencers.map((i) => i._id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    const newOrder = arrayMove(ids, oldIndex, newIndex);

    setLocalOrder(newOrder);
    reorder.mutate(newOrder);
  };

  return (
    <AppShell>
      <div className="px-6 py-6 max-w-6xl">
        <header className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Users className="size-5 text-primary" />
              Influencers
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your roster — drag rows to reorder by priority.
            </p>
          </div>
          {canEdit && <AddInfluencerDialog />}
        </header>

        <div className="card-surface rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-md" />
              ))}
            </div>
          ) : isError ? (
            <div className="p-6 text-sm text-destructive">
              Failed to load influencers: {(error as Error).message}
            </div>
          ) : !influencers || influencers.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <p>No influencers yet.</p>
              <p className="mt-1 text-xs">
                {canEdit
                  ? "Click Add influencer above to create your first one."
                  : "Ask an admin to add the first influencer."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {canEdit && <TableHead className="w-8" />}
                  <TableHead>Name</TableHead>
                  {PLATFORM_KEYS.map((k) => (
                    <TableHead key={k}>{PLATFORMS[k].label}</TableHead>
                  ))}
                  <TableHead>Portal login</TableHead>
                  <TableHead>Infloww ID</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={orderedInfluencers.map((i) => i._id)}
                  strategy={verticalListSortingStrategy}
                >
                  <TableBody>
                    {orderedInfluencers.map((inf) => (
                      <SortableRow
                        key={inf._id}
                        inf={inf}
                        canEdit={canEdit}
                        canReview={canReview}
                        onEdit={() => setEditTarget(inf)}
                        onDelete={() => setDeleteTarget(inf)}
                        onReview={() => setReviewTarget(inf)}
                        onNotes={() => setNotesTarget(inf)}
                      />
                    ))}
                  </TableBody>
                </SortableContext>
              </DndContext>
            </Table>
          )}
        </div>
      </div>

      <EditInfluencerDialog
        influencer={editTarget}
        open={Boolean(editTarget)}
        onOpenChange={(o) => { if (!o) setEditTarget(null); }}
      />
      <DeleteInfluencerDialog
        influencer={deleteTarget}
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
      />
      <InfluencerNotesDialog
        influencer={notesTarget}
        open={Boolean(notesTarget)}
        onOpenChange={(o) => { if (!o) setNotesTarget(null); }}
        canEdit={canReview}
      />
      <ReviewDialog
        influencer={reviewTarget}
        open={Boolean(reviewTarget)}
        onOpenChange={(o) => { if (!o) setReviewTarget(null); }}
      />
    </AppShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Sortable row                                                                */
/* -------------------------------------------------------------------------- */

function SortableRow({
  inf,
  canEdit,
  canReview,
  onEdit,
  onDelete,
  onReview,
  onNotes,
}: {
  inf: Influencer;
  canEdit: boolean;
  canReview: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onReview: () => void;
  onNotes: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: inf._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      {canEdit && (
        <TableCell className="w-8 pr-0">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors touch-none"
            title="Drag to reorder"
          >
            <GripVertical className="size-4" />
          </button>
        </TableCell>
      )}
      <TableCell>
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-full shrink-0 overflow-hidden bg-gradient-primary grid place-items-center">
            {inf.avatarUrl ? (
              <img src={inf.avatarUrl} alt={inf.name} className="size-full object-cover" />
            ) : (
              <span className="text-primary-foreground text-[11px] font-semibold">
                {(inf.name[0] ?? "?").toUpperCase()}
              </span>
            )}
          </div>
          <span className="font-medium truncate">{inf.name}</span>
        </div>
      </TableCell>
      {PLATFORM_KEYS.map((k) => (
        <TableCell key={k}>
          <span className="text-xs text-muted-foreground">
            {inf.handles?.[k] ? `${HANDLE_PREFIX[k]}${inf.handles[k]}` : "—"}
          </span>
        </TableCell>
      ))}
      <TableCell>
        <span className="text-xs text-muted-foreground font-mono">
          {inf.loginUsername ?? "—"}
        </span>
      </TableCell>
      <TableCell>
        <span className="text-xs text-muted-foreground">
          {inf.inflowwCreatorId ?? "—"}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          {canReview && (
            <>
              <Button size="icon" variant="ghost" title="Internal notes" onClick={onNotes}>
                <FileText className="size-4" />
              </Button>
              <Button size="icon" variant="ghost" title="Write a review" onClick={onReview}>
                <MessageSquarePlus className="size-4" />
              </Button>
            </>
          )}
          {canEdit && (
            <>
              <Button size="icon" variant="ghost" onClick={onEdit}>
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={onDelete}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

/* -------------------------------------------------------------------------- */
/* Review dialog                                                               */
/* -------------------------------------------------------------------------- */

function ReviewDialog({
  influencer,
  open,
  onOpenChange,
}: {
  influencer: Influencer | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { toast } = useToast();
  const createReview = useCreateReview(influencer?._id ?? "");
  const [content, setContent] = useState("");
  const [weekKey, setWeekKey] = useState("");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);

  const reset = () => { setContent(""); setWeekKey(""); setRating(0); setHover(0); };

  if (!influencer) return null;

  const submit = () => {
    createReview.mutate(
      {
        content: content.trim(),
        weekKey: weekKey.trim() || undefined,
        rating: rating > 0 ? rating : undefined,
      },
      {
        onSuccess: () => {
          toast({ title: "Review posted" });
          reset();
          onOpenChange(false);
        },
        onError: (e) =>
          toast({
            title: "Failed to post review",
            description: (e as Error).message,
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Write a review — {influencer.name}</DialogTitle>
          <DialogDescription>
            Leave feedback for this influencer. They will see it in their portal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Rating <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star === rating ? 0 : star)}
                  onMouseEnter={() => setHover(star)}
                  onMouseLeave={() => setHover(0)}
                >
                  <Star
                    className={`size-6 transition-colors ${
                      star <= (hover || rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rv-week">
              Week <span className="text-muted-foreground text-xs">(optional, e.g. 2025-W20)</span>
            </Label>
            <Input
              id="rv-week"
              value={weekKey}
              onChange={(e) => setWeekKey(e.target.value)}
              placeholder="2025-W20"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rv-content">
              Review <span className="text-destructive">*</span>
            </Label>
            <textarea
              id="rv-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your feedback here…"
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Btn variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Btn>
          <Btn onClick={submit} disabled={!content.trim() || createReview.isPending}>
            {createReview.isPending && <Loader2 className="size-4 animate-spin" />}
            Post review
          </Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
