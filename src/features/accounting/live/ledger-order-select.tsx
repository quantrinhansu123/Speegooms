"use client";

import { useEffect, useState } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useListData } from "./list-query";

export type LedgerOrder = { code: string; customerName: string };

export function LedgerOrderSelect({ value, onChange }: { value: LedgerOrder | null; onChange: (order: LedgerOrder | null) => void }) {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setSearched(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);
  const { rows, loading, error, paging } = useListData<LedgerOrder>("/api/ke-toan/ledger-orders", "orders", { q: searched }, "Không tải được hợp đồng", true);
  const pending = loading || query !== searched;

  return <Combobox.Root
    items={pending ? [] : rows}
    value={value}
    itemToStringLabel={(order: LedgerOrder) => [order.code, order.customerName].filter(Boolean).join(" · ")}
    isItemEqualToValue={(a, b) => a.code === b.code}
    filter={null}
    onValueChange={onChange}
    onOpenChange={(open) => { if (!open) setQuery(""); }}
    onInputValueChange={(text, details) => {
      if (details.reason === "input-change" || details.reason === "clear-press") setQuery(text.trim());
    }}
  >
    <Combobox.InputGroup className="relative">
      <Combobox.Input id="ledger-order" maxLength={200} placeholder="Tìm mã hợp đồng hoặc tên khách…" render={<Input className="pr-16" />} />
      <div className="absolute inset-y-0 right-1 flex items-center">
        <Combobox.Clear aria-label="Bỏ chọn hợp đồng" className="rounded p-1.5 hover:bg-muted"><X className="size-4" aria-hidden /></Combobox.Clear>
        <Combobox.Trigger aria-label="Mở danh sách hợp đồng" className="rounded p-1.5 hover:bg-muted"><ChevronDown className="size-4" aria-hidden /></Combobox.Trigger>
      </div>
    </Combobox.InputGroup>
    <Combobox.Portal>
      <Combobox.Positioner sideOffset={4} className="z-[60]">
        <Combobox.Popup className="w-[var(--anchor-width)] rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-md">
          <Combobox.Empty className="px-3 py-2 text-muted-foreground">{pending ? "Đang tìm hợp đồng…" : error ?? "Không có hợp đồng phù hợp."}</Combobox.Empty>
          <Combobox.List className="max-h-60 overflow-y-auto overscroll-contain">
            {(order: LedgerOrder) => <Combobox.Item key={order.code} value={order} className="cursor-default break-words rounded px-3 py-2 outline-none data-highlighted:bg-muted data-selected:font-semibold">
              {order.code} · {order.customerName}
            </Combobox.Item>}
          </Combobox.List>
          {query === searched && paging.pages > 1 && <div className="flex items-center justify-between gap-1 border-t px-1 pt-1" onMouseDown={(event) => event.preventDefault()}>
            <Button type="button" size="sm" variant="ghost" disabled={loading || paging.page <= 1} onClick={() => paging.setPage(paging.page - 1)}>Trang trước</Button>
            <span className="text-xs tabular-nums">{paging.page} / {paging.pages}</span>
            <Button type="button" size="sm" variant="ghost" disabled={loading || paging.page >= paging.pages} onClick={() => paging.setPage(paging.page + 1)}>Trang sau</Button>
          </div>}
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>;
}
