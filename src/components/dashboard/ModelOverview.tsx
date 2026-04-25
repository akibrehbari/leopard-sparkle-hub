import type { ModelProfile } from "@/data/types";
import { formatNumber, modelTotalFollowers } from "@/data/selectors";
import { cn } from "@/lib/utils";
import { Layers } from "lucide-react";

interface Props {
  model: ModelProfile;
}

const statusStyles: Record<string, string> = {
  Active: "bg-success/15 text-success ring-1 ring-success/30",
  Inactive: "bg-muted text-muted-foreground ring-1 ring-border",
  Testing: "bg-warning/15 text-warning ring-1 ring-warning/30",
};

export function ModelOverview({ model }: Props) {
  const isAggregate = model.id === "all";
  return (
    <div className="card-surface rounded-xl p-5 flex items-center gap-5 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-primary opacity-[0.06] pointer-events-none" />
      {isAggregate ? (
        <div className="size-16 rounded-2xl bg-gradient-primary grid place-items-center shadow-glow shrink-0">
          <Layers className="size-7 text-primary-foreground" />
        </div>
      ) : (
        <img
          src={model.profileImage}
          alt={model.stageName}
          className="size-16 rounded-2xl object-cover ring-2 ring-primary/30 shrink-0"
        />
      )}
      <div className="flex-1 min-w-0 relative">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-xl font-bold text-foreground truncate">{model.stageName}</h2>
          <span className={cn("text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full", statusStyles[model.status])}>
            {model.status}
          </span>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{model.actualName}</div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-gradient-primary tabular-nums">
            {formatNumber(modelTotalFollowers(model))}
          </span>
          <span className="text-xs text-muted-foreground">total audience</span>
        </div>
      </div>
    </div>
  );
}