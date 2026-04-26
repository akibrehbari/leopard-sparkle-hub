"use client";

import { cn } from "@/lib/utils";
import { Layers, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreators } from "@/lib/infloww/hooks";
import type { InflowwCreator } from "@/lib/infloww/types";

interface Props {
  selectedId: string;
  onSelect: (id: string) => void;
}

/** Sidebar: lists all connected creators from /v1/creators. */
export function Sidebar({ selectedId, onSelect }: Props) {
  const { data, isLoading, isError, error } = useCreators({ limit: 100 });
  const creators: InflowwCreator[] = data?.data?.list ?? [];

  return (
    <aside className="hidden lg:flex w-72 flex-col border-r border-border bg-sidebar shrink-0 h-screen sticky top-0">
      <div className="px-6 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-lg bg-gradient-primary grid place-items-center shadow-glow">
            <span className="text-primary-foreground font-bold text-sm">eL</span>
          </div>
          <div>
            <div className="text-sm font-semibold text-sidebar-foreground leading-tight">
              eLeopards
            </div>
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
              : "text-sidebar-foreground hover:bg-sidebar-accent/50",
          )}
        >
          <Layers className="size-4 text-primary" />
          <span className="font-medium">All Models</span>
          <span className="ml-auto text-[11px] text-muted-foreground">
            {isLoading ? "…" : creators.length}
          </span>
        </button>
      </div>

      <div className="px-3 pb-4 flex-1 overflow-y-auto scrollbar-thin">
        <div className="px-3 pb-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          Models
        </div>

        {isLoading ? (
          <div className="space-y-2 px-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-2 py-2.5 rounded-lg"
              >
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex items-start gap-2 mx-2 p-3 rounded-lg bg-destructive/10 text-destructive border border-destructive/30 text-xs">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Couldn’t load creators</div>
              <div className="text-destructive/80 mt-0.5">
                {(error as Error)?.message ?? "Unknown error"}
              </div>
            </div>
          </div>
        ) : creators.length === 0 ? (
          <div className="mx-2 p-3 rounded-lg bg-secondary/40 border border-border text-xs text-muted-foreground">
            No creators connected to your Infloww account yet.
          </div>
        ) : (
          <div className="space-y-1">
            {creators.map((c) => {
              const active = selectedId === c.id;
              const display = c.nickName || c.name || c.userName || c.id;
              const subtitle = c.userName ? `@${c.userName}` : c.tagName || "";
              return (
                <button
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-primary/20"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                  )}
                >
                  <div className="size-8 rounded-full bg-gradient-primary grid place-items-center shrink-0 ring-1 ring-border">
                    <span className="text-primary-foreground text-xs font-semibold">
                      {(display[0] ?? "?").toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{display}</div>
                    {subtitle && (
                      <div className="text-[11px] text-muted-foreground truncate">
                        {subtitle}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-sidebar-border text-[11px] text-muted-foreground">
        v0.2 · Infloww · Internal use
      </div>
    </aside>
  );
}
