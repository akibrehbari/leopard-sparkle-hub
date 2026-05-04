"use client";

/**
 * Recipient-side model switcher in the share topbar.
 *
 * Renders a Command-style dropdown with searchable list of all models in
 * the share's roster. Picking a model triggers `onSelect` with the new id;
 * the parent navigates to the new URL which causes the server to re-render
 * with that influencer's data.
 */

import { useState } from "react";
import { Check, ChevronsUpDown, Users } from "lucide-react";

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
import { cn } from "@/lib/utils";
import type { ShareRosterMember } from "@/lib/share/types";

interface Props {
  roster: ShareRosterMember[];
  currentId: string;
  onSelect: (id: string) => void;
}

export function ShareSwitcher({ roster, currentId, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const current = roster.find((r) => r._id === currentId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          className="gap-2 min-w-[180px] justify-between"
        >
          <span className="flex items-center gap-2 min-w-0">
            <Users className="size-4 shrink-0" />
            <span className="truncate">
              {current?.name ?? "Switch model"}
            </span>
          </span>
          <ChevronsUpDown className="size-3.5 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[260px]"
        align="end"
      >
        <Command>
          <CommandInput placeholder="Search models..." />
          <CommandList>
            <CommandEmpty>No models.</CommandEmpty>
            <CommandGroup>
              {roster.map((m) => (
                <CommandItem
                  key={m._id}
                  value={m.name}
                  onSelect={() => {
                    setOpen(false);
                    if (m._id !== currentId) onSelect(m._id);
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      m._id === currentId ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {m.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
