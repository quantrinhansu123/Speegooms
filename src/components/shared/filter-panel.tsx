"use client";

import { useState, type ReactNode } from "react";
import { Popover } from "@base-ui/react/popover";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FilterPanel({ toolbar, count = 0, children }: { toolbar?: ReactNode; count?: number; children: ReactNode }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  return <div ref={setContainer} className="mb-4 rounded-xl border bg-card">
    <div className="flex flex-wrap items-center gap-2 p-3">
      {toolbar}
      <div className="ml-auto flex items-center gap-2 print:hidden">
      <div data-table-column-toolbar className="flex items-center gap-2" />
      <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger render={<Button type="button" variant={open || count ? "secondary" : "outline"} aria-label="Bộ lọc" title="Bộ lọc" />}>
        <Filter aria-hidden />{count > 0 && <span className="rounded-full bg-primary/10 px-1.5 text-xs">{count}</span>}
      </Popover.Trigger>
      <Popover.Portal container={container} keepMounted>
      <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50 max-w-[calc(100vw-2rem)]">
        <Popover.Popup aria-label="Bộ lọc" className="max-h-[min(70vh,var(--available-height))] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg outline-none">
          <Popover.Title className="mb-3 text-sm font-semibold">Bộ lọc</Popover.Title>
          <div className="grid items-end gap-3 sm:grid-cols-2">{children}</div>
        </Popover.Popup>
      </Popover.Positioner>
      </Popover.Portal>
      </Popover.Root>
      </div>
    </div>
  </div>;
}
