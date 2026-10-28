"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CRM_TODAY, temperatureMeta } from "@/config/crm";
import { formatDayMonth } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Lead, Temperature } from "@/types/crm";
import { useCrm } from "../hooks";
import { CareBadge, SourceTag } from "./meta-badges";

const columns: Temperature[] = ["hot", "warm", "cold"];
const PAGE = 8;
const accent: Record<Temperature, string> = { hot: "bg-danger", warm: "bg-warning", cold: "bg-info" };

function LeadCard({ lead, onLost, onNotice }: { lead: Lead; onLost: (messId: string) => void; onNotice: (msg: string) => void }) {
  const { actions, staffName, can } = useCrm();
  const writable = can("lead.write");
  const overdue = lead.nextTask && !lead.nextTask.done && lead.nextTask.dueOn < CRM_TODAY;
  return (
    <li className="rounded-lg border bg-surface p-3 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/crm/leads/${lead.messId}`} className="min-w-0 rounded text-sm font-semibold text-foreground hover:text-primary hover:underline">
          <span className="block truncate">{lead.contactName}</span>
        </Link>
        {writable && (
          <DropdownMenu>
            <DropdownMenuTrigger aria-label={`Thao tác lead ${lead.contactName}`} className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
              <MoreHorizontal aria-hidden className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {columns
                .filter((c) => c !== lead.temperature)
                .map((c) => (
                  <DropdownMenuItem
                    key={c}
                    onClick={() => {
                      const res = actions.setTemperature(lead.messId, c);
                      onNotice(res.ok ? "" : res.error);
                    }}
                  >
                    Chuyển sang {temperatureMeta[c].label}
                  </DropdownMenuItem>
                ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onLost(lead.messId)}>
                Mất khách…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{lead.company}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <SourceTag source={lead.source} />
        <CareBadge value={lead.careStatus} />
      </div>
      <p className="mt-2 truncate text-xs text-muted-foreground">{staffName(lead.ownerId)}</p>
      {lead.nextTask && !lead.nextTask.done && (
        <p className={cn("mt-1.5 flex items-center gap-1 text-xs", overdue ? "font-medium text-danger" : "text-muted-foreground")}>
          <CalendarClock aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">
            {formatDayMonth(lead.nextTask.dueOn)} · {lead.nextTask.title}
          </span>
          {overdue && <span className="sr-only">(quá hạn)</span>}
        </p>
      )}
    </li>
  );
}

/** Kanban Hot / Warm / Cold. Đổi cột bằng menu thao tác (không cần kéo thả, dùng được bằng bàn phím). */
export function LeadKanban({ leads, onLost }: { leads: Lead[]; onLost: (messId: string) => void }) {
  const [shown, setShown] = useState<Record<Temperature, number>>({ hot: PAGE, warm: PAGE, cold: PAGE });
  const [notice, setNotice] = useState("");
  // Kanban là pipeline trước RFQ: lead đã có RFQ hoặc đã mất khách xem trong dạng danh sách
  const active = leads.filter((l) => l.careStatus !== "mat" && l.careStatus !== "da-co-rfq");

  return (
    <div>
      {notice && (
        <p role="alert" className="mb-3 rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger">
          {notice}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map((col) => {
          const items = active.filter((l) => l.temperature === col);
          return (
            <section key={col} aria-label={`Cột ${temperatureMeta[col].label}`} className="rounded-xl bg-muted/60 p-3">
              <h3 className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold">
                <span aria-hidden className={cn("size-2.5 rounded-full", accent[col])} />
                {temperatureMeta[col].label}
                <span className="tabular ml-auto rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-muted-foreground">{items.length}</span>
              </h3>
              {items.length === 0 ? (
                <p className="px-1 py-6 text-center text-sm text-muted-foreground">Không có lead</p>
              ) : (
                <ul className="space-y-2.5">
                  {items.slice(0, shown[col]).map((l) => (
                    <LeadCard key={l.messId} lead={l} onLost={onLost} onNotice={setNotice} />
                  ))}
                </ul>
              )}
              {items.length > shown[col] && (
                <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setShown((s) => ({ ...s, [col]: s[col] + PAGE }))}>
                  Xem thêm ({items.length - shown[col]})
                </Button>
              )}
            </section>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Lead đã có RFQ hoặc đã mất khách không hiển thị trên Kanban, xem trong dạng danh sách.</p>
    </div>
  );
}
