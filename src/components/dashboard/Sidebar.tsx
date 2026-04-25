import { cn } from "@/lib/utils";
import { MODELS } from "@/data/mockModels";
import { modelTotalFollowers, formatNumber } from "@/data/selectors";
import { Layers } from "lucide-react";

interface Props {
  selectedId: string;
  onSelect: (id: string) => void;
}

const statusDot: Record<string, string> = {
  Active: "bg-success",
  Inactive: "bg-muted-foreground",
  Testing: "bg-warning",
};

export function Sidebar({ selectedId, onSelect }: Props) {
  return (
    <aside className="hidden lg:flex w-72 flex-col border-r border-border bg-sidebar shrink-0 h-screen sticky top-0">
      <div className="px-6 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-lg bg-gradient-primary grid place-items-center shadow-glow">
            <span className="text-primary-foreground font-bold text-sm">eL</span>
          </div>
          <div>
            <div className="text-sm font-semibold text-sidebar-foreground leading-tight">eLeopards</div>
            <div className="text-[11px] text-muted-foreground">Clients Dashboard</div>
          </div>
        </div>
      </div>

      <div className="px-3 py-4">
        <div className="px-3 pb-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          Overview
        </div>
        <button
          onClick={() => onSelect("all")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
            selectedId === "all"
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent/50"
          )}
        >
          <Layers className="size-4 text-primary" />
          <span className="font-medium">All Models</span>
          <span className="ml-auto text-[11px] text-muted-foreground">{MODELS.length}</span>
        </button>
      </div>

      <div className="px-3 pb-4 flex-1 overflow-y-auto scrollbar-thin">
        <div className="px-3 pb-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          Models
        </div>
        <div className="space-y-1">
          {MODELS.map((m) => {
            const active = selectedId === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onSelect(m.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-primary/20"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <div className="relative">
                  <img
                    src={m.profileImage}
                    alt={m.stageName}
                    className="size-8 rounded-full object-cover ring-1 ring-border"
                  />
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-sidebar",
                      statusDot[m.status]
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{m.stageName}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {formatNumber(modelTotalFollowers(m))} followers
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-6 py-4 border-t border-sidebar-border text-[11px] text-muted-foreground">
        v0.1 · Internal use
      </div>
    </aside>
  );
}