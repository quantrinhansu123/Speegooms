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
      <DropdownMenuTrigger aria-label={label} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
        <MoreHorizontal aria-hidden className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {items.map((item) => (
          <DropdownMenuItem key={item.key} variant={item.destructive ? "destructive" : "default"} onClick={item.onClick}>
            {item.icon}
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
