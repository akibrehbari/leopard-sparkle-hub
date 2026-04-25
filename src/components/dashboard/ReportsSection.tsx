import type { ModelProfile } from "@/data/types";
import { CalendarClock, FileText } from "lucide-react";

interface Props {
  model: ModelProfile;
}

export function ReportsSection({ model }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="card-surface rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="size-8 rounded-lg bg-info/15 text-info grid place-items-center">
            <FileText className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Weekly Report</h3>
            <p className="text-[11px] text-muted-foreground">Last 7 days summary</p>
          </div>
        </div>
        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
          {model.notes.weeklyReport || "No report available."}
        </p>
      </div>
      <div className="card-surface rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="size-8 rounded-lg bg-primary/15 text-primary grid place-items-center">
            <CalendarClock className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Upcoming Plan</h3>
            <p className="text-[11px] text-muted-foreground">Next steps & priorities</p>
          </div>
        </div>
        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
          {model.notes.upcomingPlan || "No plan recorded."}
        </p>
      </div>
    </div>
  );
}