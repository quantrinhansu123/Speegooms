"use client";

import { useId, useState, type ReactNode } from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FilterPanel({ toolbar, count = 0, children }: { toolbar?: ReactNode; count?: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div className="mb-4 rounded-xl border bg-card">
    <div className="flex flex-wrap items-center gap-2 p-3">
      {toolbar}
      <Button type="button" variant={open || count ? "secondary" : "outline"} className="ml-auto" aria-label="Bộ lọc" title="Bộ lọc" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <Filter aria-hidden />{count > 0 && <span className="rounded-full bg-primary/10 px-1.5 text-xs">{count}</span>}
      </Button>
    </div>
    <div id={id} hidden={!open}><div className="grid items-end gap-3 border-t bg-muted/20 p-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div></div>
  </div>;
}
