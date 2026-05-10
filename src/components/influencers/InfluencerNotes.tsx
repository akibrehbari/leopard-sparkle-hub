"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Megaphone, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";

const MAX_CHARS = 2000;

interface Props {
  influencerId: string;
  initialMarketingNotes: string | null | undefined;
  initialOfNotes: string | null | undefined;
  /** When false the boxes are read-only (e.g. manager viewing, not a worker). */
  canEdit?: boolean;
}

function CharCounter({ value, max }: { value: string; max: number }) {
  const remaining = max - value.length;
  return (
    <span
      className={`text-[11px] tabular-nums ${
        remaining < 100 ? "text-destructive" : "text-muted-foreground"
      }`}
    >
      {value.length} / {max}
    </span>
  );
}

export function InfluencerNotes({
  influencerId,
  initialMarketingNotes,
  initialOfNotes,
  canEdit = true,
}: Props) {
  const { toast } = useToast();
  const [marketing, setMarketing] = useState(initialMarketingNotes ?? "");
  const [of, setOf] = useState(initialOfNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Re-sync when the influencer changes (e.g. worker switches between influencers)
  useEffect(() => {
    setMarketing(initialMarketingNotes ?? "");
    setOf(initialOfNotes ?? "");
    setDirty(false);
  }, [influencerId, initialMarketingNotes, initialOfNotes]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/influencers/${influencerId}/notes`, {
        marketingNotes: marketing || null,
        ofNotes: of || null,
      });
      toast({ title: "Notes saved" });
      setDirty(false);
    } catch (e) {
      toast({
        title: "Failed to save notes",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Internal notes
        </h2>
        {canEdit && dirty && (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            Save notes
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Marketing content notes */}
        <div className="card-surface rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5 text-sm">
              <Megaphone className="size-3.5 text-primary" />
              Marketing content
            </Label>
            <CharCounter value={marketing} max={MAX_CHARS} />
          </div>
          <textarea
            value={marketing}
            onChange={(e) => {
              setMarketing(e.target.value.slice(0, MAX_CHARS));
              setDirty(true);
            }}
            rows={8}
            readOnly={!canEdit}
            placeholder={
              canEdit
                ? "Add notes about marketing strategy, content ideas, campaign notes…"
                : "No marketing notes yet."
            }
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none disabled:opacity-60"
          />
        </div>

        {/* OF content notes */}
        <div className="card-surface rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5 text-sm">
              <Heart className="size-3.5 text-[#00AFF0]" />
              OF content
            </Label>
            <CharCounter value={of} max={MAX_CHARS} />
          </div>
          <textarea
            value={of}
            onChange={(e) => {
              setOf(e.target.value.slice(0, MAX_CHARS));
              setDirty(true);
            }}
            rows={8}
            readOnly={!canEdit}
            placeholder={
              canEdit
                ? "Add notes about OnlyFans content, posting schedule, subscriber engagement…"
                : "No OF notes yet."
            }
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none disabled:opacity-60"
          />
        </div>
      </div>
    </div>
  );
}
