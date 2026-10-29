"use client";

import { MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function RowMenu({
  label,
  items,
}: {
  label: string;
  items: { key: string; label: string; onClick: () => void; destructive?: boolean; icon?: React.ReactNode }[];
}) {
  if (items.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={label} className="mx-auto flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:size-10">
        <MoreHorizontal aria-hidden className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-max min-w-28 max-w-56 rounded-xl border border-border/70 p-1 shadow-lg shadow-black/5 ring-0">
        {items.map((item) => (
            <DropdownMenuItem key={item.key} className="min-h-11 cursor-pointer gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors sm:min-h-8" variant={item.destructive ? "destructive" : "default"} onClick={item.onClick}>
              {item.icon && <span aria-hidden className="flex size-4 shrink-0 items-center justify-center text-muted-foreground group-data-[variant=destructive]/dropdown-menu-item:text-destructive [&_svg]:size-3.5">{item.icon}</span>}
              <span className="whitespace-normal">{item.label}</span>
            </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
