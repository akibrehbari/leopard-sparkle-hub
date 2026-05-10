"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";

const MAX_CHARS = 5000;

interface Props {
  influencerId: string;
  initialNotes: string | null | undefined;
  canEdit?: boolean;
}

function CharCounter({ value, max }: { value: string; max: number }) {
  const remaining = max - value.length;
  return (
    <span className={`text-[11px] tabular-nums ${remaining < 200 ? "text-destructive" : "text-muted-foreground"}`}>
      {value.length} / {max}
    </span>
  );
}

export function TrackerNotes({ influencerId, initialNotes, canEdit = true }: Props) {
  const { toast } = useToast();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setNotes(initialNotes ?? "");
    setDirty(false);
  }, [influencerId, initialNotes]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/influencers/${influencerId}/notes`, {
        trackerNotes: notes || null,
      });
      toast({ title: "Notes saved" });
      setDirty(false);
    } catch (e) {
      toast({ title: "Failed to save", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card-surface rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <StickyNote className="size-3.5" />
          Tracker notes
        </h3>
        <div className="flex items-center gap-2">
          <CharCounter value={notes} max={MAX_CHARS} />
          {canEdit && dirty && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Save
            </Button>
          )}
        </div>
      </div>
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value.slice(0, MAX_CHARS));
          setDirty(true);
        }}
        rows={6}
        readOnly={!canEdit}
        placeholder={
          canEdit
            ? "Add tracking notes, weekly observations, action items…"
            : "No tracker notes yet."
        }
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y disabled:opacity-60"
      />
    </div>
  );
}
