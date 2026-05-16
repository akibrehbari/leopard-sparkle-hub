"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors w-full",
        "text-sidebar-foreground hover:bg-sidebar-accent/60",
        className,
      )}
    >
      {/* Toggle track */}
      <div
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors duration-300 shrink-0 border border-sidebar-border",
          isDark ? "bg-sidebar-foreground/20" : "bg-sidebar-foreground/15",
        )}
      >
        {/* Thumb */}
        <div
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full transition-all duration-300 shadow-sm",
            isDark
              ? "translate-x-4 bg-sidebar-foreground"
              : "translate-x-0.5 bg-sidebar-primary",
          )}
        />
      </div>

      <span className="flex items-center gap-1.5 font-medium text-xs">
        {isDark ? (
          <><Moon className="size-3.5" />Dark</>
        ) : (
          <><Sun className="size-3.5" />Light</>
        )}
      </span>
    </button>
  );
}
