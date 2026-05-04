"use client";

/**
 * Combobox for picking an optional linked influencer.
 *
 * Used by the add + edit subreddit dialogs. Wrapped in Popover + cmdk so
 * the operator can type-search through a long roster.
 */

import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useInfluencers } from "@/lib/influencers/influencers.hooks";
import { cn } from "@/lib/utils";

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
}

export function InfluencerCombobox({
  value,
  onChange,
  placeholder = "Pick an influencer (optional)",
}: Props) {
  const { data: influencers, isLoading } = useInfluencers();
  const [open, setOpen] = useState(false);

  const selected = influencers?.find((i) => i._id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between font-normal"
        >
          <span className={cn(!selected && "text-muted-foreground")}>
            {selected ? selected.name : placeholder}
          </span>
          <div className="flex items-center gap-1">
            {selected && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear selection"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(null);
                  }
                }}
                className="grid place-items-center rounded p-0.5 hover:bg-muted"
              >
                <X className="size-3.5 opacity-60" />
              </span>
            )}
            <ChevronsUpDown className="size-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
        <Command>
          <CommandInput placeholder="Search influencers..." />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Loading..." : "No influencers."}
            </CommandEmpty>
            <CommandGroup>
              {(influencers ?? []).map((inf) => (
                <CommandItem
                  key={inf._id}
                  value={inf.name}
                  onSelect={() => {
                    onChange(inf._id === value ? null : inf._id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      value === inf._id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {inf.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
