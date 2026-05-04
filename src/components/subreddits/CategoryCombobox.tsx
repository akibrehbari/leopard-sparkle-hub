"use client";

/**
 * Category picker for subreddits.
 *
 * Strict combobox over the curated `SUBREDDIT_CATEGORIES` registry. We
 * intentionally don't allow free-form input — keeping the list closed
 * prevents typos that would fragment the filter dropdown ("fitness" vs
 * "Fitness" vs "fit") and lets us assume a known shape elsewhere.
 *
 * To add a category, edit `src/lib/subreddits/categories.ts`.
 */

import { useState } from "react";
import { Check, ChevronsUpDown, Tag } from "lucide-react";

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
import {
  SUBREDDIT_CATEGORIES,
  categoryLabel,
} from "@/lib/subreddits/categories";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}

export function CategoryCombobox({
  value,
  onChange,
  placeholder = "Pick a category",
}: Props) {
  const [open, setOpen] = useState(false);

  const select = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between font-normal"
        >
          <span className="flex items-center gap-2 min-w-0">
            <Tag className="size-3.5 shrink-0 opacity-60" />
            <span
              className={cn("truncate", !value && "text-muted-foreground")}
            >
              {value ? categoryLabel(value) : placeholder}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[var(--radix-popover-trigger-width)]"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search categories..." />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup>
              {SUBREDDIT_CATEGORIES.map((c) => (
                <CommandItem
                  key={c.key}
                  value={c.label}
                  onSelect={() => select(c.key)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      value === c.key ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {c.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
